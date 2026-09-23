import React, { useState } from "react";
import { getInterviewPrep, type InterviewCategory } from "../api/client";
import { ClipboardIcon, CodeIcon, UsersIcon, TargetIcon, RefreshIcon, SparkleIcon } from "./Icons";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Technical:       <CodeIcon size={14} />,
  Behavioral:      <UsersIcon size={14} />,
  "Role-specific": <TargetIcon size={14} />,
};

export default function InterviewPrep() {
  const [categories, setCategories] = useState<InterviewCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  async function handleGenerate() {
    setLoading(true); setError(null);
    try {
      const res = await getInterviewPrep();
      setCategories(res.categories);
      setGenerated(true);
      setActiveTab(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate questions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-icon panel-icon--brand"><ClipboardIcon size={15} /></div>
          Interview Prep
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleGenerate}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="btn-inner"><span className="spinner" /> Generating…</span>
          ) : generated ? (
            <span className="btn-inner"><RefreshIcon size={13} /> Regenerate</span>
          ) : (
            <span className="btn-inner"><SparkleIcon size={13} /> Generate Questions</span>
          )}
        </button>
      </div>

      <div className="panel-body">
        {error && <p className="error-msg" role="alert">{error}</p>}

        {!generated && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardIcon size={18} /></div>
            Click "Generate Questions" to get categorised interview prep<br />
            grounded in this specific job description.
          </div>
        )}

        {generated && categories.length > 0 && (
          <>
            <div className="tabs" role="tablist">
              {categories.map((cat, idx) => (
                <button
                  key={cat.category}
                  role="tab"
                  aria-selected={activeTab === idx}
                  className={`tab ${activeTab === idx ? "tab--active" : ""}`}
                  onClick={() => setActiveTab(idx)}
                >
                  <span className="tab-icon">
                    {CATEGORY_ICONS[cat.category] ?? <ClipboardIcon size={14} />}
                  </span>
                  {cat.category}
                </button>
              ))}
            </div>

            {categories[activeTab] && (
              <div role="tabpanel" aria-label={categories[activeTab].category}>
                <ol className="question-list">
                  {categories[activeTab].questions.map((q, qi) => (
                    <li key={qi} className="question-item">
                      <div className="question-number">Q{qi + 1}</div>
                      <p className="question-text">{q.question}</p>
                      <p className="question-rationale">
                        <span className="rationale-label">Why: </span>{q.rationale}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
