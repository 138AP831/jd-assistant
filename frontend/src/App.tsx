import React, { useState } from "react";
import JDInput from "./components/JDInput";
import ChatBox from "./components/ChatBox";
import InterviewPrep from "./components/InterviewPrep";
import WeakSpots from "./components/WeakSpots";
import {
  BrainIcon, DocumentIcon, ChatIcon, ClipboardIcon,
  AlertIcon, CheckCircleIcon, TargetIcon, CodeIcon,
} from "./components/Icons";
import FloatingBot from "./components/FloatingBot";
import "./App.css";

type NavPage = "analyse" | "qa" | "prep" | "weakspots";

export default function App() {
  const [ingested, setIngested]   = useState(false);
  const [chunkCount, setChunkCount] = useState(0);
  const [page, setPage]           = useState<NavPage>("analyse");

  function handleIngested(count: number) {
    setChunkCount(count);
    setIngested(true);
    setPage("qa");
  }

  const navItems: { id: NavPage; label: string; icon: React.ReactNode; requiresIngest?: boolean }[] = [
    { id: "analyse",   label: "Analyse JD",     icon: <DocumentIcon size={15} /> },
    { id: "qa",        label: "Q&A",            icon: <ChatIcon size={15} />,      requiresIngest: true },
    { id: "prep",      label: "Interview Prep", icon: <ClipboardIcon size={15} />, requiresIngest: true },
    { id: "weakspots", label: "Weak Spots",     icon: <AlertIcon size={15} />,     requiresIngest: true },
  ];

  return (
    <div className="app">
      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <BrainIcon size={18} />
          </div>
          <div className="brand-text">
            <div className="brand-name">JD Assistant</div>
            <div className="brand-sub">AI-Powered Recruitment</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>

          {navItems.map((item) => {
            const disabled = item.requiresIngest && !ingested;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? "nav-item--active" : ""} ${disabled ? "nav-item--disabled" : ""}`}
                onClick={() => !disabled && setPage(item.id)}
                aria-current={page === item.id ? "page" : undefined}
                disabled={disabled}
                title={disabled ? "Analyse a JD first" : undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.id === "analyse" && ingested && (
                  <span className="nav-badge">{chunkCount}</span>
                )}
              </button>
            );
          })}

          <span className="nav-section-label" style={{ marginTop: ".5rem" }}>Features</span>
          <button className="nav-item" disabled style={{ opacity: .4, cursor: "default" }}>
            <span className="nav-icon"><CodeIcon size={15} /></span>
            Tech Stack
          </button>
          <button className="nav-item" disabled style={{ opacity: .4, cursor: "default" }}>
            <span className="nav-icon"><TargetIcon size={15} /></span>
            Role Fit Score
          </button>
        </nav>

        <div className="sidebar-footer">
          Powered by Gemini RAG<br />
          FastAPI · React · Vite
        </div>
      </aside>

      {/* ══ MAIN BODY ══ */}
      <div className="app-body">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-title">
            <h1>{navItems.find(n => n.id === page)?.label ?? "JD Assistant"}</h1>
            <p>AI-powered job description insights and interview preparation</p>
          </div>
          <div className="topbar-actions">
            {ingested ? (
              <span className="status-pill status-pill--ready">
                <span className="status-dot" />
                {chunkCount} chunks ready
              </span>
            ) : (
              <span className="status-pill">
                <span className="status-dot" />
                No JD loaded
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="app-main">

          {/* ── Welcome banner (always on analyse page before ingest) ── */}
          {page === "analyse" && !ingested && (
            <div className="welcome-panel">
              <div className="welcome-header">
                <div className="welcome-icon"><BrainIcon size={18} /></div>
                <h3>Get Started — Paste a Job Description</h3>
              </div>
              <p>
                Analyse any job posting with Gemini RAG to unlock grounded Q&amp;A,
                tailored interview questions, and resume gap analysis.
              </p>
              <div className="welcome-chips">
                <span className="welcome-chip"><CheckCircleIcon size={12} /> Grounded answers</span>
                <span className="welcome-chip"><CheckCircleIcon size={12} /> Interview prep</span>
                <span className="welcome-chip"><CheckCircleIcon size={12} /> Resume gap analysis</span>
                <span className="welcome-chip"><CheckCircleIcon size={12} /> Not-stated detection</span>
              </div>
            </div>
          )}

          {/* ── Stat row (after ingest) ── */}
          {ingested && (
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon stat-icon--purple"><DocumentIcon size={18} /></div>
                  <span className="stat-delta stat-delta--up">
                    <CheckCircleIcon size={11} /> Ready
                  </span>
                </div>
                <div className="stat-value">{chunkCount}</div>
                <div className="stat-label">JD Chunks Indexed</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon stat-icon--cyan"><ChatIcon size={18} /></div>
                </div>
                <div className="stat-value">Q&amp;A</div>
                <div className="stat-label">Grounded Answers</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon stat-icon--green"><ClipboardIcon size={18} /></div>
                </div>
                <div className="stat-value">3</div>
                <div className="stat-label">Interview Categories</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div className="stat-icon stat-icon--orange"><AlertIcon size={18} /></div>
                </div>
                <div className="stat-value">GAP</div>
                <div className="stat-label">Resume Analysis</div>
              </div>
            </div>
          )}

          {/* ── Page panels ── */}
          {page === "analyse" && <JDInput onIngested={handleIngested} />}
          {page === "qa"        && ingested && <ChatBox />}
          {page === "prep"      && ingested && <InterviewPrep />}
          {page === "weakspots" && ingested && <WeakSpots />}
        </main>

        <footer className="app-footer">
          JD Assistant — Built with FastAPI · Gemini RAG · React · Vite
        </footer>
      </div>

      {/* ══ FLOATING COACH BOT — always present ══ */}
      <FloatingBot />
    </div>
  );
}
