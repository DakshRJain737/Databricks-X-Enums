import re
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pypdf import PdfReader
import io
from app.core.security import get_current_user
from app.core.db import User
from app.core.databricks import get_genie, call_foundation_model

router = APIRouter(prefix="/api/placement", tags=["placement"])

# Real, published JD-style eligibility criteria (kept small & explicit —
# swap for a Lakeflow-synced table in production).
DRIVES = [
    {"company": "Amazon", "role": "SDE-1", "min_cgpa": 7.0, "branches": ["CSE", "ISE", "AIML"],
     "skills": ["dsa", "system design", "java", "python"]},
    {"company": "TCS", "role": "Digital", "min_cgpa": 6.0, "branches": ["CSE", "ISE", "ECE", "AIML"],
     "skills": ["dsa", "sql", "communication"]},
    {"company": "Infosys", "role": "SDE", "min_cgpa": 6.5, "branches": ["CSE", "ISE"],
     "skills": ["dsa", "oops", "dbms"]},
]

SKILL_KEYWORDS = [
    # Core CS fundamentals
    "dsa", "data structures", "algorithms", "system design", "oops",
    "operating systems", "os", "dbms", "computer networks", "cn",
    "compiler design", "theory of computation", "discrete mathematics",

    # Languages
    "python", "java", "c++", "c", "c#", "javascript", "typescript",
    "go", "golang", "rust", "kotlin", "swift", "scala", "r", "php", "ruby",

    # Web development
    "html", "css", "react", "reactjs", "angular", "vue", "next.js",
    "node", "nodejs", "express", "django", "flask", "fastapi",
    "spring", "spring boot", "rest api", "graphql", "webpack", "redux",

    # Databases
    "sql", "mysql", "postgresql", "mongodb", "redis", "cassandra",
    "sqlite", "oracle", "dynamodb", "elasticsearch", "firebase",

    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "ci/cd", "jenkins", "github actions", "ansible", "linux", "bash",
    "nginx", "microservices", "serverless",

    # Data / ML / AI
    "machine learning", "deep learning", "neural networks", "nlp",
    "computer vision", "data science", "data analysis", "pandas",
    "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
    "statistics", "data visualization", "power bi", "tableau",
    "big data", "spark", "hadoop", "etl", "genai", "llm", "rag",

    # Mobile
    "android", "ios", "flutter", "react native", "swiftui",

    # Version control & tools
    "git", "github", "gitlab", "jira", "confluence", "figma",

    # Testing & QA
    "unit testing", "selenium", "junit", "pytest", "test automation",

    # Soft / general
    "communication", "leadership", "problem solving", "teamwork",
    "agile", "scrum", "project management",

    # Security & blockchain
    "cybersecurity", "penetration testing", "blockchain", "solidity",
    "cryptography",
]


def extract_text(file_bytes: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return file_bytes.decode(errors="ignore")


def detect_skills(text: str) -> list[str]:
    lower = text.lower()
    return [s for s in SKILL_KEYWORDS if s in lower]


@router.post("/analyze")
async def analyze_resume(
    resume: UploadFile = File(...),
    cgpa: float = Form(...),
    branch: str = Form(...),
    user: User = Depends(get_current_user),
):
    raw = await resume.read()
    text = extract_text(raw, resume.filename)
    found_skills = detect_skills(text)

    eligibility = []
    for drive in DRIVES:
        eligible = cgpa >= drive["min_cgpa"] and branch.upper() in [b.upper() for b in drive["branches"]]
        missing = [s for s in drive["skills"] if s not in found_skills]
        eligibility.append({
            "company": drive["company"],
            "role": drive["role"],
            "eligible": eligible,
            "missing_skills": missing,
            "matched_skills": [s for s in drive["skills"] if s in found_skills],
        })

    # 1) Genie handles the DATA question — something it can turn into SQL
    #    against career_academics.raw.placement_drives / students.
    genie_question = (
        f"For a {branch} student with CGPA {cgpa}, which rows in placement_drives "
        f"have min_cgpa <= {cgpa} and include '{branch}' in eligible_branches? "
        f"List company, role, and required_skills for each matching drive."
    )
    genie = get_genie("career_academics")
    genie_response = await genie.ask(genie_question)

    # 2) The Foundation Model handles the WRITING/REASONING task — turning
    #    the eligibility + skill-gap data into an actual improvement plan.
    #    This is NOT a SQL question, so it doesn't go to Genie.
    plan_prompt = (
        f"A {branch} student with CGPA {cgpa} has these detected skills: {found_skills}. "
        f"Their eligibility results are: {eligibility}. "
        f"Write a short, encouraging readiness assessment (2-3 sentences) and a "
        f"3-point skill-gap improvement plan to become eligible for more drives."
    )
    plan_response = await call_foundation_model(plan_prompt)

    readiness_score = round(
        100 * len(found_skills) / max(len(SKILL_KEYWORDS), 1), 1
    )

    return {
        "detected_skills": found_skills,
        "readiness_score": readiness_score,
        "eligibility": eligibility,
        "genie_analysis": genie_response,
        "improvement_plan": plan_response,
    }
