import re
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pypdf import PdfReader
import io
from app.core.security import get_current_user
from app.core.db import User
from app.core.databricks import get_genie

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

SKILL_KEYWORDS = ["dsa", "system design", "java", "python", "sql", "oops", "dbms",
                   "react", "node", "aws", "docker", "kubernetes", "machine learning"]


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

    question = (
        f"Student with CGPA {cgpa}, branch {branch}, detected skills: {found_skills}. "
        f"Give a readiness assessment and a skill-gap improvement plan against these "
        f"drives: {[d['company'] for d in DRIVES]}."
    )
    genie = get_genie("career_academics")
    genie_response = await genie.ask(question)

    readiness_score = round(
        100 * len(found_skills) / max(len(SKILL_KEYWORDS), 1), 1
    )

    return {
        "detected_skills": found_skills,
        "readiness_score": readiness_score,
        "eligibility": eligibility,
        "genie_analysis": genie_response,
    }
