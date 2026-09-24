"""
Gemini generation service.

Contains all prompt templates and LLM calls for:
  - Grounded Q&A
  - Interview prep generation
  - Resume weak-spots / gap analysis
"""

import os
import json
import re
import time
from typing import List, Dict, Any

import google.generativeai as genai


def _configure() -> None:
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise EnvironmentError("GOOGLE_API_KEY environment variable is not set.")
    genai.configure(api_key=api_key)


def _get_model() -> genai.GenerativeModel:
    _configure()
    # Override via GEMINI_MODEL env var, defaults to gemini-3.5-flash-lite
    model_name = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
    return genai.GenerativeModel(model_name)


def _generate_with_retry(model: genai.GenerativeModel, prompt: str, max_retries: int = 4) -> str:
    """
    Call model.generate_content with exponential backoff on 429 rate-limit errors.
    Waits 2, 4, 8, 16 seconds between retries.
    """
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            err = str(e)
            if "429" in err and attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)  # 2, 4, 8, 16 seconds
                time.sleep(wait)
                continue
            raise


def _extract_json(text: str) -> Any:
    """
    Extract JSON from a Gemini response that may include markdown fences.
    Tries to parse the raw text first; if that fails strips ```json ... ``` blocks.
    """
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown code fences
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())

    raise ValueError(f"Could not extract JSON from LLM response:\n{text[:500]}")


# ── Grounded Q&A ─────────────────────────────────────────────────────────────

def answer_question(question: str, context_chunks: List[str]) -> str:
    """
    Answer *question* using only the provided *context_chunks*.

    If the answer cannot be found in the context, the model is instructed
    to say "This is not stated in this posting."
    """
    model = _get_model()
    context = "\n\n---\n\n".join(context_chunks)

    prompt = f"""You are a helpful assistant that answers questions about a job description.
You must ONLY use the information provided in the CONTEXT below to answer the question.
Do not use any outside knowledge.

If the answer is not present in the context, respond with exactly:
"This is not stated in this posting."

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:"""

    return _generate_with_retry(model, prompt)


# ── Interview Prep ────────────────────────────────────────────────────────────

_INTERVIEW_PREP_PROMPT = """You are an expert career coach specialising in technical interview preparation.

Given the job description excerpts below, generate a focused set of interview questions
organised into exactly THREE categories:
1. Technical
2. Behavioral
3. Role-specific

Rules:
- Every question MUST reference something concrete and specific from the job description
  (e.g. a named technology, responsibility, or stated requirement).
- Each question must include a one-line "rationale" explaining which part of the JD it targets.
- Produce at least 4 questions per category, with a mix of fixed/behavioural and
  open-ended formats.
- Questions should be high-quality and focused — not generic fillers.
- Output ONLY valid JSON in this exact structure (no markdown, no extra text):

{{
  "categories": [
    {{
      "category": "Technical",
      "questions": [
        {{"question": "...", "rationale": "..."}}
      ]
    }},
    {{
      "category": "Behavioral",
      "questions": [
        {{"question": "...", "rationale": "..."}}
      ]
    }},
    {{
      "category": "Role-specific",
      "questions": [
        {{"question": "...", "rationale": "..."}}
      ]
    }}
  ]
}}

JOB DESCRIPTION EXCERPTS:
{jd_context}"""


def generate_interview_prep(jd_chunks: List[str]) -> Dict:
    """
    Generate categorised interview questions grounded in *jd_chunks*.

    Returns a dict matching InterviewPrepResponse schema.
    """
    model = _get_model()
    jd_context = "\n\n---\n\n".join(jd_chunks)

    prompt = _INTERVIEW_PREP_PROMPT.format(jd_context=jd_context)
    text = _generate_with_retry(model, prompt)

    data = _extract_json(text)
    return data


# ── Weak Spots / Gap Analysis ─────────────────────────────────────────────────

_WEAK_SPOTS_PROMPT = """You are an expert career coach performing a gap analysis.

Compare the RESUME below against the JOB DESCRIPTION EXCERPTS.
Identify the candidate's likely weak spots — areas where the JD explicitly requires
skills, experience, or qualifications that are absent, unclear, or underdeveloped
in the resume.

Rules:
- Focus only on gaps that are clearly stated as requirements or strong preferences in the JD.
- Be specific: name the skill, tool, or experience area and cite why it's a gap.
- Do NOT invent gaps that aren't grounded in the JD.
- If the resume is a strong match and gaps are minimal, return a short list (1–3 items).
- Output ONLY valid JSON in this exact structure (no markdown, no extra text):

{{
  "weak_spots": [
    {{
      "area": "short label for the gap (e.g. 'Kubernetes experience')",
      "reason": "one or two sentences explaining the gap with reference to the JD"
    }}
  ]
}}

JOB DESCRIPTION EXCERPTS:
{jd_context}

RESUME:
{resume_text}"""


def analyze_weak_spots(jd_chunks: List[str], resume_text: str) -> Dict:
    """
    Perform a gap analysis between *resume_text* and *jd_chunks*.

    Returns a dict matching WeakSpotsResponse schema.
    """
    model = _get_model()
    jd_context = "\n\n---\n\n".join(jd_chunks)

    prompt = _WEAK_SPOTS_PROMPT.format(
        jd_context=jd_context,
        resume_text=resume_text,
    )
    text = _generate_with_retry(model, prompt)

    data = _extract_json(text)
    return data


# ── Interview Coach ───────────────────────────────────────────────────────────

_COACH_SYSTEM = """You are an expert interview coach with deep knowledge of technical and behavioural interviews across software engineering, data science, product, and business roles.

Your job is to help candidates prepare for job interviews. You can:
- Explain how to answer specific interview question types (STAR method, system design, coding, etc.)
- Give tips on how to present experience and projects convincingly
- Suggest follow-up questions a candidate should ask the interviewer
- Help the candidate practice by role-playing as an interviewer
- Advise on salary negotiation, offer evaluation, and interview etiquette

Keep answers concise, practical, and encouraging. Use bullet points when listing tips.
If the user has a JD loaded, tailor your advice to that context when relevant."""


def coach_reply(message: str, history: list) -> str:
    """
    Reply to an interview coaching message, maintaining conversation history.

    Args:
        message: The latest user message.
        history: List of {"role": str, "content": str} dicts (prior turns).

    Returns:
        The assistant's reply as a plain string.
    """
    model = _get_model()

    # Build a single prompt that encodes history + system context
    turns = []
    for turn in history[-10:]:  # keep last 10 turns to stay within context limits
        role = "User" if turn["role"] == "user" else "Coach"
        turns.append(f"{role}: {turn['content']}")

    history_text = "\n".join(turns)
    sep = "\n\n---\n\n" if history_text else ""

    prompt = f"""{_COACH_SYSTEM}

{history_text}{sep}User: {message}

Coach:"""

    return _generate_with_retry(model, prompt)
