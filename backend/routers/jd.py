"""
JD Assistant API router.

Endpoints:
  POST /api/ingest          — Chunk, embed, and store a job description
  POST /api/ask             — Grounded Q&A against the ingested JD
  POST /api/interview-prep  — Generate categorised interview questions
  POST /api/weak-spots      — Gap analysis between a resume and the JD
  POST /api/coach           — Floating interview coach bot (free-form Q&A)
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from models.schemas import (
    IngestRequest,
    IngestResponse,
    AskRequest,
    AskResponse,
    InterviewPrepResponse,
    WeakSpotsRequest,
    WeakSpotsResponse,
    CoachRequest,
    CoachResponse,
)
from services.chunker import chunk_text
from services.embedder import embed_documents, embed_query
from services.vector_store import store
from services.resume_parser import extract_text
from services import llm

router = APIRouter()


# ── POST /api/ingest ─────────────────────────────────────────────────────────

@router.post("/ingest", response_model=IngestResponse)
def ingest_jd(body: IngestRequest) -> IngestResponse:
    """
    Chunk the job description, embed every chunk with Gemini, and store the
    resulting vectors in the in-memory VectorStore.

    Each call resets the store so a fresh JD always starts clean.
    """
    chunks = chunk_text(body.jd_text)

    if not chunks:
        raise HTTPException(status_code=422, detail="JD produced no chunks after splitting.")

    try:
        embeddings = embed_documents(chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding error: {exc}") from exc

    store.reset()
    store.add(chunks, embeddings)

    return IngestResponse(chunk_count=len(chunks), status="ready")


# ── POST /api/ask ────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse)
def ask_question(body: AskRequest) -> AskResponse:
    """
    Answer a free-text question using only content from the ingested JD.

    Returns the answer and the top retrieved chunks used as context.
    """
    if store.size == 0:
        raise HTTPException(
            status_code=400,
            detail="No JD has been ingested yet. Call POST /api/ingest first.",
        )

    try:
        q_embedding = embed_query(body.question)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding error: {exc}") from exc

    results = store.search(q_embedding, top_k=5)
    context_chunks = [r["chunk"] for r in results]

    try:
        answer = llm.answer_question(body.question, context_chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return AskResponse(answer=answer, source_chunks=context_chunks)


# ── POST /api/interview-prep ─────────────────────────────────────────────────

@router.post("/interview-prep", response_model=InterviewPrepResponse)
def interview_prep() -> InterviewPrepResponse:
    """
    Generate a focused, categorised set of interview questions grounded in
    the ingested JD.

    Categories: Technical / Behavioral / Role-specific.
    Each question includes a one-line rationale tied to the JD.
    """
    if store.size == 0:
        raise HTTPException(
            status_code=400,
            detail="No JD has been ingested yet. Call POST /api/ingest first.",
        )

    # Use all chunks for interview prep (want full JD coverage)
    all_chunks = store.get_all_chunks()

    try:
        data = llm.generate_interview_prep(all_chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return InterviewPrepResponse(**data)


# ── POST /api/weak-spots ─────────────────────────────────────────────────────

@router.post("/weak-spots", response_model=WeakSpotsResponse)
def weak_spots(body: WeakSpotsRequest) -> WeakSpotsResponse:
    """
    Compare a pasted resume against the ingested JD and surface likely
    skill / experience gaps.

    Requires a JD to have been ingested first via POST /api/ingest.
    """
    if store.size == 0:
        raise HTTPException(
            status_code=400,
            detail="No JD has been ingested yet. Call POST /api/ingest first.",
        )

    all_chunks = store.get_all_chunks()

    try:
        data = llm.analyze_weak_spots(all_chunks, body.resume_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return WeakSpotsResponse(**data)


# ── POST /api/extract-resume ──────────────────────────────────────────────────

@router.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)) -> JSONResponse:
    """
    Accept a PDF, DOCX, or TXT resume upload and return extracted plain text.
    The frontend calls this first, then passes the text to /api/weak-spots.
    """
    MAX_SIZE = 5 * 1024 * 1024  # 5 MB

    contents = await file.read()

    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 5 MB.",
        )

    try:
        text, fmt = extract_text(file.filename or "resume.pdf", contents)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return JSONResponse({"text": text, "format": fmt, "length": len(text)})

@router.post("/coach", response_model=CoachResponse)
def coach(body: CoachRequest) -> CoachResponse:
    """
    Floating interview coach bot — free-form interview advice and practice.

    Accepts the latest user message plus prior conversation history.
    Does NOT require a JD to be ingested (but uses it for context if available).
    """
    history = [{"role": m.role, "content": m.content} for m in body.history]

    try:
        reply = llm.coach_reply(body.message, history)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    return CoachResponse(reply=reply)

# ── POST /api/coach ───────────────────────────────────────────────────────────

@router.post("/coach", response_model=CoachResponse)
def coach(body: CoachRequest) -> CoachResponse:
    """
    Floating interview coach bot — free-form interview advice and practice.
    """
    history = [{"role": m.role, "content": m.content} for m in body.history]
    try:
        reply = llm.coach_reply(body.message, history)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc
    return CoachResponse(reply=reply)
