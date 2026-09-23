"""
JD Assistant — FastAPI entry point.

Start locally:
    uvicorn main:app --reload --port 8000
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import google.generativeai as genai

# Load .env in development (no-op in production where env vars are injected)
load_dotenv()

# Configure Gemini SDK at startup
_api_key = os.environ.get("GOOGLE_API_KEY")
if _api_key:
    genai.configure(api_key=_api_key)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="JD Assistant API",
    description="Grounded Q&A + Interview Prep + Coach powered by Gemini RAG",
    version="1.2.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

from routers.jd import router as jd_router  # noqa: E402 — must come after app init

app.include_router(jd_router, prefix="/api")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
