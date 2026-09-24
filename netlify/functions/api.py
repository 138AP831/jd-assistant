"""
Netlify serverless function entry point.

Netlify routes all /.netlify/functions/api/* requests here.
We use Mangum to wrap the FastAPI ASGI app as an AWS Lambda-compatible handler,
which is what Netlify Functions uses under the hood.
"""

import os
import sys

# Add the function directory to path so sibling imports work
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers.jd import router as jd_router

# Configure Gemini
_api_key = os.environ.get("GOOGLE_API_KEY")
if _api_key:
    genai.configure(api_key=_api_key)

app = FastAPI(
    title="JD Assistant API",
    description="Grounded Q&A + Interview Prep + Coach powered by Gemini RAG",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jd_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Mangum wraps FastAPI as a Lambda/Netlify handler
handler = Mangum(app, lifespan="off")
