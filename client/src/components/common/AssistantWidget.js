// client/src/components/common/AssistantWidget.js
//
// "Ask EduMapping" — the placement assistant. A floating button that opens a
// chat panel. Hidden entirely when the server has no assistant configured, so
// an install without an API key shows nothing broken.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon, XMarkIcon, PaperAirplaneIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { cx } from '../ui';

const SUGGESTIONS = {
  student: ['Which jobs can I apply to right now?', "What's my next round?", 'Why can’t I apply to a job?', 'What is my profile missing?'],
  tpo: ['How do I verify student records?', 'How do I set up a dream-company policy?', 'How do I export the NIRF report?'],
  recruiter: ['How do I schedule interview rounds?', 'How do I shortlist by roll number?', 'How do I make an offer?'],
  default: ['What can I do on EduMapping?', 'How do live classes work?']
};

/** Render **bold** and [label](/path) links; everything else as text. */
const renderInline = (text) => {
  const parts = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2];
      parts.push(
        href.startsWith('/') ? (
          <Link key={m.index} to={href} className="font-semibold text-azure-700 underline underline-offset-2">
            {m[1]}
          </Link>
        ) : (
          <a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-azure-700 underline">
            {m[1]}
          </a>
        )
      );
    } else {
      parts.push(<strong key={m.index}>{m[3]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const Message = ({ role, content }) => (
  <div className={cx('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
    <div
      className={cx(
        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        role === 'user' ? 'rounded-br-md bg-ink-950 text-white' : 'rounded-bl-md border border-ink-950/10 bg-bone-50 text-ink-900'
      )}
    >
      {content.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && '\n'}
          {renderInline(line.replace(/^[-*] /, '• '))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const AssistantWidget = () => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .get('/assistant/status', { silent: true })
      .then((res) => setEnabled(Boolean(res.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!enabled) return null;

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post('/assistant/chat', { messages: next }, { silent: true });
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: 'assistant', content: err?.response?.data?.message || err?.message || 'I could not answer right now. Please try again.' }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const suggestions = SUGGESTIONS[user?.role] || SUGGESTIONS.default;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-ink-950 bg-ink-950 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-[4px_4px_0_0_#FF9933] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 focus-visible:ring-offset-2"
        >
          <SparklesIcon className="h-5 w-5 text-saffron-400" aria-hidden="true" />
          Ask EduMapping
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Ask EduMapping assistant"
          className="fixed inset-x-3 bottom-3 z-[70] flex h-[min(36rem,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-3xl border border-ink-950/15 bg-white shadow-lift-lg animate-slide-up sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24rem]"
        >
          <header className="flex items-center gap-3 border-b border-ink-950/10 bg-ink-950 px-4 py-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
              <SparklesIcon className="h-5 w-5 text-saffron-400" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-display text-sm font-bold">Ask EduMapping</p>
              <p className="text-[11px] text-white/60">Answers from your own placement data</p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="New conversation" title="New conversation">
                <ArrowPathIcon className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close assistant">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-700">
                  Hi {user?.firstName}. Ask me about drives, eligibility, your rounds or how to do something in EduMapping.
                </p>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border border-ink-950/15 px-3 py-2 text-left text-sm text-ink-800 transition-colors hover:border-ink-950 hover:bg-bone-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <Message key={i} {...m} />
            ))}
            {busy && (
              <div className="flex gap-1.5 px-1" aria-label="Thinking">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-pulse-dot rounded-full bg-saffron-500" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-ink-950/10 p-3"
          >
            <label htmlFor="assistant-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question…"
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border border-ink-950/15 px-3.5 py-2.5 text-sm focus:border-ink-950 focus:outline-none focus:ring-2 focus:ring-ink-950/15"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Send"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-ink-950 text-white transition-opacity disabled:opacity-40"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
};

export default AssistantWidget;
