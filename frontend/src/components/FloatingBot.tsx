import React, { useState, useRef, useEffect } from "react";
import { askCoach, type CoachMessage } from "../api/client";
import { SendIcon, ChevronDownIcon } from "./Icons";

/* ── Suggestion chips shown before first message ─────────────────────────── */
const SUGGESTIONS = [
  "How do I answer 'Tell me about yourself'?",
  "Tips for system design interviews",
  "How to negotiate a job offer?",
  "What questions should I ask the interviewer?",
  "How to use the STAR method?",
];

export default function FloatingBot() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<CoachMessage[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [unread, setUnread]       = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  /* scroll to bottom on new message */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* focus input when panel opens */
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg) return;

    const userMsg: CoachMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askCoach(msg, [...messages, userMsg]);
      const botMsg: CoachMessage = { role: "assistant", content: res.reply };
      setMessages((prev) => [...prev, botMsg]);
      if (!open) setUnread((n) => n + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <>
      {/* ── Floating panel ───────────────────────────────────────────────── */}
      {open && (
        <div className="bot-panel" role="dialog" aria-label="Interview Coach">
          {/* Header */}
          <div className="bot-header">
            <div className="bot-header-left">
              <div className="bot-avatar">
                <BotFaceIcon />
              </div>
              <div>
                <div className="bot-name">Interview Coach</div>
                <div className="bot-status">
                  <span className="bot-online-dot" />
                  Online — ask me anything
                </div>
              </div>
            </div>
            <button
              className="bot-close"
              onClick={() => setOpen(false)}
              aria-label="Close coach"
            >
              <ChevronDownIcon size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="bot-messages" role="log" aria-live="polite">
            {/* Welcome message */}
            <div className="bot-msg bot-msg--assistant">
              <div className="bot-bubble">
                Hi! I'm your interview coach. Ask me anything — from how to
                handle behavioural questions to salary negotiation tips.
              </div>
            </div>

            {/* Suggestion chips — only before first user message */}
            {messages.length === 0 && (
              <div className="bot-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="bot-chip"
                    onClick={() => send(s)}
                    disabled={loading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`bot-msg bot-msg--${msg.role}`}>
                <div className="bot-bubble">{msg.content}</div>
              </div>
            ))}

            {loading && (
              <div className="bot-msg bot-msg--assistant">
                <div className="bot-bubble bot-bubble--typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {error && (
              <div className="bot-msg bot-msg--assistant">
                <div className="bot-bubble bot-bubble--error">{error}</div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="bot-input-row">
            <textarea
              ref={inputRef}
              className="bot-input"
              placeholder="Ask the coach…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              rows={1}
              aria-label="Message the interview coach"
            />
            <button
              className="bot-send"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label="Send"
            >
              {loading ? <span className="bot-spinner" /> : <SendIcon size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Floating trigger button ───────────────────────────────────────── */}
      <button
        className={`bot-trigger ${open ? "bot-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close interview coach" : "Open interview coach"}
        aria-expanded={open}
      >
        {open ? <ChevronDownIcon size={22} /> : <BotFaceIcon size={22} />}
        {!open && unread > 0 && (
          <span className="bot-unread">{unread}</span>
        )}
      </button>
    </>
  );
}

/* Inline bot face SVG — matches the orange chat-bot icon in the reference */
function BotFaceIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="8" width="18" height="12" rx="3" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9.5 17.5h5" strokeWidth="1.6" />
      <line x1="12" y1="8" x2="12" y2="5" />
    </svg>
  );
}
