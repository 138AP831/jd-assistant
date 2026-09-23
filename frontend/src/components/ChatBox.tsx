import React, { useState, useRef, useEffect } from "react";
import { askQuestion, type AskResponse } from "../api/client";
import { ChatIcon, SendIcon, SourceIcon, ChevronRightIcon } from "./Icons";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res: AskResponse = await askQuestion(question);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer, sources: res.source_chunks }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to get answer.");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function toggleSources(idx: number) {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-icon panel-icon--accent"><ChatIcon size={15} /></div>
          Grounded Q&amp;A
        </div>
        <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
          Answers are grounded in the JD only
        </span>
      </div>
      <div className="panel-body">
        <div className="message-list" role="log" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><ChatIcon size={18} /></div>
              Ask anything about this job description.<br />
              e.g. "Is this role remote?" · "What stack is required?" · "What seniority level is this?"
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message message--${msg.role}`}>
              <span className="message-label">{msg.role === "user" ? "You" : "JD Assistant"}</span>
              <p className="message-text">{msg.content}</p>
              {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <button
                    className="sources-toggle"
                    onClick={() => toggleSources(idx)}
                    aria-expanded={expandedSources.has(idx)}
                  >
                    <SourceIcon size={11} />
                    <ChevronRightIcon size={11} className={`source-chevron ${expandedSources.has(idx) ? "source-chevron--open" : ""}`} />
                    Source context ({msg.sources.length} chunks)
                  </button>
                  {expandedSources.has(idx) && (
                    <ul className="sources-list">
                      {msg.sources.map((chunk, ci) => (
                        <li key={ci} className="source-chunk">{chunk}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message message--assistant">
              <span className="message-label">JD Assistant</span>
              <p className="message-text typing-indicator"><span /><span /><span /></p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="error-msg" role="alert">{error}</p>}

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            placeholder="Ask a question about the JD… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            rows={2}
            aria-label="Your question"
          />
          <button
            className="btn btn-primary btn-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="Send"
            aria-busy={loading}
          >
            {loading ? <span className="spinner" /> : <SendIcon size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
