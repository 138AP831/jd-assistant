/**
 * Typed API client for the JD Assistant backend.
 *
 * - On Vercel: frontend and backend share the same domain.
 *   BASE_URL is empty — all requests go to /api/* on the same origin.
 * - Locally: VITE_API_URL=http://localhost:8000 in frontend/.env.local
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string) ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestResponse {
  chunk_count: number;
  status: string;
}

export interface AskResponse {
  answer: string;
  source_chunks: string[];
}

export interface InterviewQuestion {
  question: string;
  rationale: string;
}

export interface InterviewCategory {
  category: string;
  questions: InterviewQuestion[];
}

export interface InterviewPrepResponse {
  categories: InterviewCategory[];
}

export interface WeakSpot {
  area: string;
  reason: string;
}

export interface WeakSpotsResponse {
  weak_spots: WeakSpot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Unknown error");
  }

  return res.json() as Promise<T>;
}

// ── Endpoint wrappers ─────────────────────────────────────────────────────────

export const ingestJD = (jd_text: string) =>
  post<IngestResponse>("/api/ingest", { jd_text });

export const askQuestion = (question: string) =>
  post<AskResponse>("/api/ask", { question });

export const getInterviewPrep = () =>
  post<InterviewPrepResponse>("/api/interview-prep", {});

export const getWeakSpots = (resume_text: string) =>
  post<WeakSpotsResponse>("/api/weak-spots", { resume_text });

// ── Coach bot ─────────────────────────────────────────────────────────────────

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachResponse {
  reply: string;
}

export const askCoach = (message: string, history: CoachMessage[]) =>
  post<CoachResponse>("/api/coach", { message, history });

// ── Resume file upload ────────────────────────────────────────────────────────

export interface ExtractResumeResponse {
  text: string;
  format: string;
  length: number;
}

export async function extractResume(file: File): Promise<ExtractResumeResponse> {
  const form = new FormData();
  form.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${BASE_URL}/api/extract-resume`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Upload failed");
    }

    return res.json() as Promise<ExtractResumeResponse>;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out. Make sure the backend is running.");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
