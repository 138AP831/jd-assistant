from pydantic import BaseModel, field_validator
from typing import List


# ── Ingest ──────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    jd_text: str

    @field_validator("jd_text")
    @classmethod
    def jd_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("jd_text must not be empty")
        return v.strip()


class IngestResponse(BaseModel):
    chunk_count: int
    status: str


# ── Ask ─────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def question_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("question must not be empty")
        return v.strip()


class AskResponse(BaseModel):
    answer: str
    source_chunks: List[str]


# ── Interview Prep ───────────────────────────────────────────────────────────

class InterviewQuestion(BaseModel):
    question: str
    rationale: str


class InterviewCategory(BaseModel):
    category: str
    questions: List[InterviewQuestion]


class InterviewPrepResponse(BaseModel):
    categories: List[InterviewCategory]


# ── Weak Spots ───────────────────────────────────────────────────────────────

class WeakSpotsRequest(BaseModel):
    resume_text: str

    @field_validator("resume_text")
    @classmethod
    def resume_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("resume_text must not be empty")
        return v.strip()


class WeakSpot(BaseModel):
    area: str
    reason: str


class WeakSpotsResponse(BaseModel):
    weak_spots: List[WeakSpot]


# ── Interview Coach (floating bot) ───────────────────────────────────────────

class CoachMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class CoachRequest(BaseModel):
    message: str
    history: List[CoachMessage] = []

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("message must not be empty")
        return v.strip()


class CoachResponse(BaseModel):
    reply: str
