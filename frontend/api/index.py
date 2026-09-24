"""
Vercel serverless entry point.

Vercel routes all /api/* requests to this file via vercel.json.
The FastAPI `app` object is picked up automatically as an ASGI handler.
"""

import os
import sys

# Ensure api/ is on the path so sibling imports (routers, services, models) work
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.jd import router as jd_router

_api_key = os.environ.get("GOOGLE_API_KEY")
if _api_key:
    genai.configure(api_key=_api_key)

app = FastAPI(
    title="JD Assistant API",
    description="Grounded Q&A + Interview Prep + Coach powered by Gemini RAG",
    version="1.2.0",
)

# On Vercel, frontend and backend share the same domain so CORS isn't needed
# for same-origin requests. We still add it for Vercel preview URLs and local dev.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jd_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
