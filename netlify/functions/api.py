"""
Netlify serverless function — fully self-contained FastAPI app.
No relative imports — everything is defined inline to avoid Lambda path issues.
"""

import os, sys, json, re, time, io
from typing import List, Dict, Any
from dotenv import load_dotenv
load_dotenv()

import numpy as np
import google.generativeai as genai
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from mangum import Mangum

# ── Gemini setup ──────────────────────────────────────────────────────────────
_api_key = os.environ.get("GOOGLE_API_KEY", "")
if _api_key:
    genai.configure(api_key=_api_key)

_EMBED_MODEL = "models/gemini-embedding-001"
_GEN_MODEL   = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")

def _get_model():
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
    return genai.GenerativeModel(_GEN_MODEL)

def _generate(model, prompt: str, retries: int = 4) -> str:
    for attempt in range(retries):
        try:
            return model.generate_content(prompt).text.strip()
        except Exception as e:
            if "429" in str(e) and attempt < retries - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            raise

def _extract_json(text: str) -> Any:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return json.loads(m.group(1).strip())
    raise ValueError(f"Could not extract JSON from response:\n{text[:300]}")

# ── Chunker ───────────────────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> List[str]:
    if not text or not text.strip():
        return []
    words = text.split()
    if len(words) <= chunk_size:
        return [" ".join(words)]
    chunks, start, step = [], 0, chunk_size - overlap
    while start < len(words):
        chunks.append(" ".join(words[start:start + chunk_size]))
        start += step
    return chunks

# ── Embedder ──────────────────────────────────────────────────────────────────
def embed_documents(texts: List[str]) -> List[List[float]]:
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
    result = genai.embed_content(model=_EMBED_MODEL, content=texts, task_type="retrieval_document")
    return result["embedding"]

def embed_query(text: str) -> List[float]:
    genai.configure(api_key=os.environ.get("GOOGLE_API_KEY", ""))
    result = genai.embed_content(model=_EMBED_MODEL, content=text, task_type="retrieval_query")
    return result["embedding"]

# ── Vector store (module-level singleton) ─────────────────────────────────────
class VectorStore:
    def __init__(self):
        self._chunks: List[str] = []
        self._matrix = None

    def reset(self):
        self._chunks = []
        self._matrix = None

    def add(self, chunks: List[str], embeddings: List[List[float]]):
        if not chunks: return
        m = np.array(embeddings, dtype=np.float32)
        self._matrix = m if self._matrix is None else np.vstack([self._matrix, m])
        self._chunks.extend(chunks)

    def search(self, q_vec: List[float], top_k: int = 5) -> List[Dict]:
        if self._matrix is None or not self._chunks: return []
        q = np.array(q_vec, dtype=np.float32)
        dn = np.linalg.norm(self._matrix, axis=1, keepdims=True)
        dn = np.where(dn == 0, 1e-10, dn)
        qn = np.linalg.norm(q) or 1e-10
        scores = (self._matrix / dn) @ (q / qn)
        top = np.argsort(scores)[::-1][:min(top_k, len(self._chunks))]
        return [{"chunk": self._chunks[i], "score": float(scores[i])} for i in top]

    def get_all_chunks(self): return list(self._chunks)
    @property
    def size(self): return len(self._chunks)

store = VectorStore()

# ── Resume parser ─────────────────────────────────────────────────────────────
def extract_resume_text(filename: str, data: bytes) -> tuple:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            text = "\n".join(p.extract_text() or "" for p in reader.pages).strip()
            if not text: raise ValueError("No text found in PDF (may be image-based).")
            return text, "pdf"
        except ImportError:
            raise ValueError("PDF parsing unavailable.")
    elif name.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            if not text: raise ValueError("No text found in DOCX.")
            return text, "docx"
        except ImportError:
            raise ValueError("DOCX parsing unavailable.")
    elif name.endswith(".txt"):
        try: return data.decode("utf-8").strip(), "txt"
        except: return data.decode("latin-1").strip(), "txt"
    else:
        raise ValueError("Unsupported file type. Use PDF, DOCX, or TXT.")

# ── Schemas ───────────────────────────────────────────────────────────────────
class IngestRequest(BaseModel):
    jd_text: str
    @field_validator("jd_text")
    @classmethod
    def not_empty(cls, v):
        if not v.strip(): raise ValueError("jd_text must not be empty")
        return v.strip()

class AskRequest(BaseModel):
    question: str
    @field_validator("question")
    @classmethod
    def not_empty(cls, v):
        if not v.strip(): raise ValueError("question must not be empty")
        return v.strip()

class WeakSpotsRequest(BaseModel):
    resume_text: str
    @field_validator("resume_text")
    @classmethod
    def not_empty(cls, v):
        if not v.strip(): raise ValueError("resume_text must not be empty")
        return v.strip()

class CoachMessage(BaseModel):
    role: str
    content: str

class CoachRequest(BaseModel):
    message: str
    history: List[CoachMessage] = []
    @field_validator("message")
    @classmethod
    def not_empty(cls, v):
        if not v.strip(): raise ValueError("message must not be empty")
        return v.strip()

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="JD Assistant API", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok", "model": _GEN_MODEL}

@app.post("/api/ingest")
def ingest(body: IngestRequest):
    chunks = chunk_text(body.jd_text)
    if not chunks:
        raise HTTPException(422, "JD produced no chunks.")
    try:
        embeddings = embed_documents(chunks)
    except Exception as e:
        raise HTTPException(502, f"Embedding error: {e}")
    store.reset()
    store.add(chunks, embeddings)
    return {"chunk_count": len(chunks), "status": "ready"}

@app.post("/api/ask")
def ask(body: AskRequest):
    if store.size == 0:
        raise HTTPException(400, "No JD ingested yet.")
    try:
        q_vec = embed_query(body.question)
    except Exception as e:
        raise HTTPException(502, f"Embedding error: {e}")
    results = store.search(q_vec, top_k=5)
    ctx = [r["chunk"] for r in results]
    prompt = f"""You are a helpful assistant answering questions about a job description.
Only use the CONTEXT below. If the answer isn't there, say "This is not stated in this posting."

CONTEXT:
{chr(10).join(ctx)}

QUESTION: {body.question}
ANSWER:"""
    try:
        answer = _generate(_get_model(), prompt)
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")
    return {"answer": answer, "source_chunks": ctx}

@app.post("/api/interview-prep")
def interview_prep():
    if store.size == 0:
        raise HTTPException(400, "No JD ingested yet.")
    jd_ctx = "\n\n---\n\n".join(store.get_all_chunks())
    prompt = f"""You are an expert career coach. Generate interview questions for this JD in exactly 3 categories:
Technical, Behavioral, Role-specific.

Rules:
- Each question must reference something specific from the JD.
- Each question must have a one-line "rationale".
- At least 4 questions per category.
- Output ONLY valid JSON:

{{"categories":[{{"category":"Technical","questions":[{{"question":"...","rationale":"..."}}]}},{{"category":"Behavioral","questions":[{{"question":"...","rationale":"..."}}]}},{{"category":"Role-specific","questions":[{{"question":"...","rationale":"..."}}]}}]}}

JOB DESCRIPTION:
{jd_ctx}"""
    try:
        data = _extract_json(_generate(_get_model(), prompt))
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")
    return data

@app.post("/api/weak-spots")
def weak_spots(body: WeakSpotsRequest):
    if store.size == 0:
        raise HTTPException(400, "No JD ingested yet.")
    jd_ctx = "\n\n---\n\n".join(store.get_all_chunks())
    prompt = f"""You are a career coach doing a gap analysis.
Compare the RESUME against the JD. Find likely weak spots where the JD requires skills absent in the resume.
Output ONLY valid JSON:

{{"weak_spots":[{{"area":"...","reason":"..."}}]}}

JD:
{jd_ctx}

RESUME:
{body.resume_text}"""
    try:
        data = _extract_json(_generate(_get_model(), prompt))
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")
    return data

@app.post("/api/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    MAX = 5 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX:
        raise HTTPException(413, "File too large. Max 5MB.")
    try:
        text, fmt = extract_resume_text(file.filename or "resume.pdf", contents)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return JSONResponse({"text": text, "format": fmt, "length": len(text)})

@app.post("/api/coach")
def coach(body: CoachRequest):
    history = "\n".join(
        f"{'User' if m.role == 'user' else 'Coach'}: {m.content}"
        for m in body.history[-10:]
    )
    sep = "\n\n---\n\n" if history else ""
    prompt = f"""You are an expert interview coach. Help candidates prepare for job interviews.
Give concise, practical advice. Use bullet points for tips.

{history}{sep}User: {body.message}
Coach:"""
    try:
        reply = _generate(_get_model(), prompt)
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")
    return {"reply": reply}

# ── Mangum handler ────────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
