import io
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.core.security import get_current_user
from app.core.db import User
from app.core.databricks import get_genie

router = APIRouter(prefix="/api/pdf-qa", tags=["pdf-qa"])

# In-memory session store: {session_id: {"chunks": [...], "vectorizer":..., "matrix":...}}
# Swap for Databricks Vector Search in production (see app/core/databricks.py).
_SESSIONS: dict[str, dict] = {}


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return [c.strip() for c in chunks if c.strip()]


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    raw = await file.read()
    reader = PdfReader(io.BytesIO(raw))
    full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not full_text.strip():
        raise HTTPException(400, "Could not extract text from this PDF")

    chunks = chunk_text(full_text)
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(chunks)

    session_id = str(uuid.uuid4())
    _SESSIONS[session_id] = {"chunks": chunks, "vectorizer": vectorizer, "matrix": matrix}
    return {"session_id": session_id, "chunk_count": len(chunks)}


@router.post("/ask")
async def ask_question(
    session_id: str = Form(...),
    question: str = Form(...),
    user: User = Depends(get_current_user),
):
    session = _SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found — upload the PDF again")

    q_vec = session["vectorizer"].transform([question])
    sims = cosine_similarity(q_vec, session["matrix"]).flatten()
    top_idx = sims.argsort()[::-1][:3]
    retrieved = [session["chunks"][i] for i in top_idx if sims[i] > 0]

    if not retrieved:
        return {"answer": "I couldn't find anything relevant to that in the uploaded document.",
                "sources": []}

    context = "\n---\n".join(retrieved)
    prompt = f"Using ONLY this document context, answer the question.\n\nContext:\n{context}\n\nQuestion: {question}"
    genie = get_genie("career_academics")
    genie_response = await genie.ask(prompt)

    return {
        "answer": genie_response["answer"],
        "mode": genie_response["mode"],
        "sources": retrieved,
    }
