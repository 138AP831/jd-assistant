import React, { useState } from "react";
import { ingestJD } from "../api/client";
import { DocumentIcon, SparkleIcon } from "./Icons";

interface Props {
  onIngested: (chunkCount: number) => void;
}

export default function JDInput({ onIngested }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!text.trim()) { setError("Please paste a job description first."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await ingestJD(text);
      onIngested(res.chunk_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to analyse JD.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-icon panel-icon--brand">
            <DocumentIcon size={15} />
          </div>
          Job Description
        </div>
        <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
          Paste the full posting below
        </span>
      </div>
      <div className="panel-body">
        <textarea
          className="jd-textarea"
          placeholder="Paste the full job description here — title, responsibilities, requirements, and anything else in the posting…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          disabled={loading}
          aria-label="Job description text"
        />
        {error && <p className="error-msg" role="alert">{error}</p>}
        <button
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
          aria-busy={loading}
        >
          {loading ? (
            <span className="btn-inner"><span className="spinner" /> Analysing…</span>
          ) : (
            <span className="btn-inner"><SparkleIcon size={14} /> Analyse JD</span>
          )}
        </button>
      </div>
    </div>
  );
}
