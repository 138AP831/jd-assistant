import React, { useState, useRef, useCallback } from "react";
import { getWeakSpots, type WeakSpot } from "../api/client";
import { extractResumeClient } from "../api/resumeExtractor";
import { AlertIcon, CheckCircleIcon, SparkleIcon } from "./Icons";

type UploadState = "idle" | "dragging" | "uploading" | "ready" | "error";

const ACCEPTED = ".pdf,.docx,.txt";
const FORMAT_LABELS: Record<string, string> = { pdf: "PDF", docx: "Word", txt: "Text" };

export default function WeakSpots() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile]               = useState<File | null>(null);
  const [resumeText, setResumeText]   = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [format, setFormat]           = useState<string>("");

  const [spots, setSpots]     = useState<WeakSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [analysed, setAnalysed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File handling ──────────────────────────────────────────────────────── */
  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setUploadState("uploading");
    setUploadError(null);
    setAnalysed(false);
    setSpots([]);

    try {
      const res = await extractResumeClient(f);
      setResumeText(res.text);
      setFormat(res.format);
      setUploadState("ready");
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Failed to parse file.");
      setUploadState("error");
      setFile(null);
    }
  }, []);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";          // allow re-selecting same file
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadState("idle");
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setUploadState("dragging"); }
  function onDragLeave()                   { setUploadState("idle"); }

  function clearFile() {
    setFile(null);
    setResumeText("");
    setFormat("");
    setUploadState("idle");
    setUploadError(null);
    setAnalysed(false);
    setSpots([]);
  }

  /* ── Analysis ───────────────────────────────────────────────────────────── */
  async function handleAnalyse() {
    if (!resumeText) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getWeakSpots(resumeText);
      setSpots(res.weak_spots);
      setAnalysed(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to analyse weak spots.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-icon panel-icon--warn"><AlertIcon size={15} /></div>
          Resume Weak Spots
        </div>
        <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
          Optional — gap analysis against the JD
        </span>
      </div>

      <div className="panel-body">
        <p className="section-desc">
          Upload your resume (PDF, DOCX, or TXT). We'll compare it against the
          job description and surface likely skill or experience gaps.
        </p>

        {/* ── Drop zone ── */}
        {uploadState !== "ready" && (
          <div
            className={`upload-zone ${uploadState === "dragging" ? "upload-zone--dragging" : ""} ${uploadState === "error" ? "upload-zone--error" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload resume — click or drag and drop"
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              style={{ display: "none" }}
              onChange={onFileInput}
              aria-hidden="true"
            />

            {uploadState === "uploading" ? (
              <div className="upload-zone-content">
                <div className="upload-spinner" aria-label="Parsing file…" />
                <p className="upload-hint">
                  {file?.name.toLowerCase().endsWith(".pdf")
                    ? <>Sending <strong>{file?.name}</strong> to backend for PDF extraction…</>
                    : <>Extracting text from <strong>{file?.name}</strong>…</>
                  }
                </p>
              </div>
            ) : (
              <div className="upload-zone-content">
                <div className="upload-icon">
                  <UploadCloudIcon />
                </div>
                <p className="upload-label">
                  {uploadState === "dragging"
                    ? "Drop it here"
                    : "Drag & drop your resume here"}
                </p>
                <p className="upload-hint">or click to browse — PDF, DOCX, TXT · max 5 MB</p>
                {uploadState === "error" && uploadError && (
                  <p className="upload-error-msg">{uploadError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── File ready card ── */}
        {uploadState === "ready" && file && (
          <div className="file-ready-card">
            <div className="file-ready-left">
              <div className="file-icon">
                <FileTypeIcon format={format} />
              </div>
              <div className="file-meta">
                <span className="file-name">{file.name}</span>
                <span className="file-info">
                  {FORMAT_LABELS[format] ?? format.toUpperCase()} ·{" "}
                  {(file.size / 1024).toFixed(0)} KB ·{" "}
                  {resumeText.split(/\s+/).length.toLocaleString()} words extracted
                </span>
              </div>
            </div>
            <button
              className="file-remove"
              onClick={clearFile}
              aria-label="Remove file"
              title="Remove and upload a different file"
            >
              <RemoveIcon />
            </button>
          </div>
        )}

        {/* ── Analyse button ── */}
        {uploadState === "ready" && (
          <>
            {error && <p className="error-msg" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              style={{ marginTop: ".875rem" }}
              onClick={handleAnalyse}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="btn-inner"><span className="spinner" /> Analysing gaps…</span>
              ) : (
                <span className="btn-inner"><SparkleIcon size={14} /> Analyse Weak Spots</span>
              )}
            </button>
          </>
        )}

        {/* ── Results ── */}
        {analysed && (
          <div className="weak-spots-results">
            {spots.length === 0 ? (
              <p className="success-state">
                <CheckCircleIcon size={16} className="inline-icon" />
                Great match — no significant gaps found between your resume and this JD.
              </p>
            ) : (
              <>
                <p className="results-title">
                  {spots.length} likely gap{spots.length !== 1 ? "s" : ""} identified
                </p>
                <ul className="spots-list">
                  {spots.map((spot, idx) => (
                    <li key={idx} className="spot-item">
                      <span className="spot-area">{spot.area}</span>
                      <p className="spot-reason">{spot.reason}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline SVG helpers ───────────────────────────────────────────────────── */
function UploadCloudIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function FileTypeIcon({ format }: { format: string }) {
  const colors: Record<string, string> = {
    pdf:  "#ef4444",
    docx: "#3b82f6",
    txt:  "#64748b",
  };
  const color = colors[format] ?? "#64748b";
  const label = (FORMAT_LABELS[format] ?? format).toUpperCase();
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" fill="none" aria-hidden="true">
      <rect width="32" height="36" rx="4" fill={`${color}18`} />
      <rect x="1" y="1" width="30" height="34" rx="3" stroke={color} strokeWidth="1.2" fill="none" />
      <text x="16" y="21" textAnchor="middle" fontSize="9" fontWeight="700"
        fill={color} fontFamily="system-ui, sans-serif">{label}</text>
    </svg>
  );
}
