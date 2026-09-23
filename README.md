# JD Assistant — Grounded Q&A + Interview Prep

A full-stack AI tool that lets you paste any job description and get:

1. **Grounded Q&A** — free-text questions answered using only the JD content (says "not stated in this posting" when the JD doesn't address something)
2. **Interview Prep** — categorised questions (Technical / Behavioral / Role-specific) tied to specific requirements in the JD, each with a one-line rationale
3. **Resume Weak Spots** *(optional)* — paste your resume for a personalised gap analysis against the JD

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | FastAPI (Python 3.11+) |
| Embeddings | Google Gemini `text-embedding-004` (dim=768) |
| Generation | Google Gemini `gemini-1.5-flash` |
| Retrieval | In-memory cosine similarity (numpy) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Architecture

```
User pastes JD
    └─▶ POST /api/ingest
            └─▶ chunk_text() — sliding-window, 150 words, 30-word overlap
            └─▶ embed_documents() — Gemini text-embedding-004, task_type=retrieval_document
            └─▶ VectorStore.add() — numpy float32 matrix, in-memory

User asks question
    └─▶ POST /api/ask
            └─▶ embed_query() — same model, task_type=retrieval_query
            └─▶ VectorStore.search() — cosine similarity, top-5 chunks
            └─▶ Gemini 1.5 Flash — grounded prompt, explicit "not stated" fallback

User requests interview prep
    └─▶ POST /api/interview-prep
            └─▶ All JD chunks passed as context
            └─▶ Gemini returns JSON: 3 categories × N questions × rationale

User pastes resume (optional)
    └─▶ POST /api/weak-spots
            └─▶ All JD chunks + resume passed to Gemini
            └─▶ Gap analysis: area + reason pairs
```

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com) API key (free tier works)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Copy and fill in your API key
copy .env.example .env
# Edit .env: set GOOGLE_API_KEY=your_key_here

uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Check `http://localhost:8000/docs` for the interactive API docs.

### Frontend

```bash
cd frontend
npm install
# .env.local is already set to http://localhost:8000
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Deployment

### Backend → Render

1. Push the repo to GitHub.
2. Create a new **Web Service** on Render, point it at the repo.
3. Set **Root Directory** to `backend`.
4. **Build Command:** `pip install -r requirements.txt`
5. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables in the Render dashboard:
   - `GOOGLE_API_KEY` — your Gemini API key
   - `ALLOWED_ORIGINS` — your Vercel URL (e.g. `https://jd-assistant.vercel.app`)

### Frontend → Vercel

1. Import the repo on Vercel.
2. Set **Root Directory** to `frontend`.
3. Add environment variable: `VITE_API_URL=https://your-render-service.onrender.com`
4. Deploy.

---

## API Reference

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/ingest` | `{"jd_text": "..."}` | Chunk + embed + store JD |
| `POST` | `/api/ask` | `{"question": "..."}` | Grounded Q&A |
| `POST` | `/api/interview-prep` | `{}` | Generate interview questions |
| `POST` | `/api/weak-spots` | `{"resume_text": "..."}` | Resume gap analysis |

Full interactive docs at `/docs` (Swagger UI) when the backend is running.

---

## Design Decisions & Tradeoffs

**Why chunk + retrieve instead of full JD in prompt?**
JDs vary wildly in length. Chunking + cosine retrieval scales to long JDs without hitting token limits, and keeps the context window focused on the most relevant passages per query.

**Why in-memory vector store?**
The simplest approach that meets the requirements. No database infrastructure to set up. The tradeoff: the store resets on server restart (Render's free tier spins down after inactivity). For production, serialising to SQLite or using Supabase pgvector would add persistence.

**Why Gemini text-embedding-004?**
Stays in a single Google ecosystem (one API key), strong retrieval performance, 768-dim vectors are lightweight for in-memory storage. The `retrieval_document` / `retrieval_query` task type distinction is explicit and well-documented.

**Why gemini-1.5-flash over pro?**
Speed and cost. Flash is fast enough for interactive Q&A and the prompts are structured enough that pro-level reasoning isn't needed. The grounded Q&A prompt explicitly constrains the model to the retrieved context, so the quality ceiling is the retrieval quality, not the model size.

**Grounding approach**
The Q&A prompt explicitly tells the model: "use ONLY the context provided, and say 'This is not stated in this posting' if the answer isn't there." This is a required behaviour per the assignment, not a nice-to-have.

---

## What I'd Improve With More Time

- **Persistence:** Serialise the vector store to disk (`.npy` + JSON) so Render restarts don't lose the ingested JD. Or swap to Supabase pgvector.
- **Streaming responses:** Use Gemini's streaming API and SSE/WebSocket to stream Q&A answers token-by-token for a snappier UX.
- **Multi-JD support:** Allow ingesting and switching between multiple JDs per session.
- **Better chunking:** Sentence-boundary-aware chunking (using `nltk.tokenize.sent_tokenize`) instead of word-count windows to avoid cutting mid-sentence.
- **Citation highlighting:** Return character offsets alongside chunks so the UI can highlight the exact JD text that grounded an answer.
- **Auth:** A simple API-key header check on the FastAPI side to prevent abuse of the public endpoint.

---

## AI Tools Used

- **Kiro (Cursor-style AI IDE):** Used to scaffold the project, generate boilerplate, and iterate on prompt templates. All architectural decisions, prompt engineering, and component design were made collaboratively.
- **Google AI Studio:** Used to test Gemini API calls and validate embedding + generation behaviour before integrating.
