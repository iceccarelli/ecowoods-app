'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EW_MARK } from '@/lib/brand';
import { onAssistantOpen } from '@/lib/assistant';
import { ASSISTANT, ASSISTANT_GREETING, ASSISTANT_CHIPS } from '@/lib/assistant-identity';

// Theme-aware by construction: these are CSS custom properties, resolved by
// the browser on every paint. Flipping data-theme on <html> restyles the whole
// widget with zero React work and zero flash. (Defined in globals.css.)
const C = {
  cream: 'var(--rg-cream)',
  paper: 'var(--rg-paper)',
  bronze: 'var(--copper)',
  bronzeDark: 'var(--copper-deep)',
  // Filled surfaces that carry text need the accessible pair, not the brand pair.
  ctaFrom: 'var(--cta-from)',
  ctaTo: 'var(--cta-to)',
  brown: 'var(--rg-ink)',
  border: 'var(--rg-border)',
  muted: 'var(--rg-muted)',
};
type Msg = { id: string; role: 'user' | 'assistant'; content: string };
const QUICK = ASSISTANT_CHIPS;
const uid = () => Math.random().toString(36).slice(2);

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  /* The launcher is position:fixed, so it parked on top of the hero trust
     stats — the first thing anyone reads. Hide it until the hero is behind
     them. IntersectionObserver, not a scroll handler: no main-thread work. */
  const [overHero, setOverHero] = useState(true);
  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) { setOverHero(false); return; }
    const io = new IntersectionObserver(
      ([e]) => setOverHero(e.isIntersecting && e.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5] },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  const [input, setInput] = useState('');
  const [showNudge, setShowNudge] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [errored, setErrored] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) return; const t = setTimeout(() => setShowNudge(true), 6000); return () => clearTimeout(t); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setErrored(false);
    const history = [...messages, { id: uid(), role: 'user' as const, content: t }];
    setMessages(history);
    setInput('');
    setBusy(true);
    const aId = uid();
    setMessages((m) => [...m, { id: aId, role: 'assistant', content: '' }]);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error('http ' + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === aId ? { ...x, content: acc } : x)));
      }
    } catch {
      setErrored(true);
      setMessages((m) => m.filter((x) => x.id !== aId));
    } finally {
      setBusy(false);
    }
  }, [messages, busy]);

  // Keep a live ref so the bus listener never fires a stale closure.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);

  /* ────────────────────────────────────────────────────────────────
     THE SEAM. The floor configurator, the ⌘K palette, exit intent and
     the WhatsApp rail all reach the agent through here — they never
     reimplement pricing or booking, they just hand the assistant a sentence
     and let estimate_project / get_availability / book_measure run.
     ──────────────────────────────────────────────────────────────── */
  useEffect(() => onAssistantOpen(({ prefill, autoSend = true, source }) => {
    setOpen(true);
    setShowNudge(false);
    if (!prefill) return;
    if (autoSend) {
      // Let the panel paint before we start streaming into it.
      setTimeout(() => sendRef.current(prefill), 120);
    } else {
      setInput(prefill);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
    if (source && typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // Dev-only telemetry breadcrumb; wire to a real analytics sink for prod.
      console.log(JSON.stringify({ event: 'assistant.opened', source }));
    }
  }), []);

  const waiting = busy && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content;

  return (
    <>
      <style>{`
        @keyframes rg-pop { from { opacity:0; transform: translateY(16px) scale(.96);} to { opacity:1; transform:none;} }
        @keyframes rg-breathe { 0%,100% { box-shadow: 0 8px 24px rgba(168,95,46,.35), 0 0 0 0 rgba(192,122,68,.45);} 50% { box-shadow: 0 8px 24px rgba(168,95,46,.35), 0 0 0 10px rgba(192,122,68,0);} }
        @keyframes rg-blink { 0%,80%,100% { opacity:.25; transform: translateY(0);} 40% { opacity:1; transform: translateY(-2px);} }
        .rg-dot { width:6px;height:6px;border-radius:50%;background:${C.bronze};display:inline-block;margin:0 2px;animation:rg-blink 1.3s infinite; }
        .rg-chip:hover { background:${C.cream}; border-color:${C.bronze}; color:${C.brown}; }
        .rg-launch:hover { transform: scale(1.05); }
      `}</style>

      {/* --fab-inset lifts this above .sticky-cta-mobile on phones, where the
          launcher used to sit squarely on top of the "Get Free Quote" button. */}
      <div className="rg-dock" data-hero={overHero} style={{ position: 'fixed', bottom: 'var(--fab-inset)', right: 'var(--fab-inset-x)', zIndex: 130, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        {!open && showNudge && (
          <div role="status" style={{ animation: 'rg-pop .3s ease', maxWidth: 220, background: C.paper, color: C.brown, border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.35, boxShadow: '0 10px 30px var(--rg-shadow)', position: 'relative' }}>
            Planning a hardwood project? Get a ballpark in about a minute.
            <button onClick={() => setShowNudge(false)} aria-label="Dismiss" style={{ position: 'absolute', top: 4, right: 6, border: 'none', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
        )}
        {!open && (
          <button className="rg-launch" onClick={() => { setOpen(true); setShowNudge(false); }} aria-label={ASSISTANT.ariaLaunch} style={{ height: 60, width: 60, borderRadius: 999, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${C.ctaFrom}, ${C.ctaTo})`, color: 'var(--cta-fg)', display: 'grid', placeItems: 'center', animation: 'rg-breathe 3.2s ease-in-out infinite', transition: 'transform .15s ease' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EW_MARK} alt="" width={34} height={34} style={{ borderRadius: 9, display: 'block' }} />
          </button>
        )}
      </div>

      {open && (
        <div role="dialog" aria-label={ASSISTANT.ariaDialog} className="rg-panel" style={{ display: 'flex', flexDirection: 'column', background: C.cream, borderRadius: 22, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 24px 60px var(--rg-shadow)', animation: 'rg-pop .26s cubic-bezier(.2,.9,.3,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: `linear-gradient(135deg, ${C.ctaFrom}, ${C.ctaTo})`, color: 'var(--cta-fg)' }}>
            <span style={{ height: 38, width: 38, borderRadius: 11, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EW_MARK} alt="" width={38} height={38} style={{ borderRadius: 11, display: 'block' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-fraunces, Georgia), serif', fontSize: 17, fontWeight: 600 }}>{ASSISTANT.name}</div>
              <div style={{ fontSize: 11.5, opacity: .92, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ height: 7, width: 7, borderRadius: 50, background: '#7ee0a0', boxShadow: '0 0 0 2px rgba(126,224,160,.3)' }} />
                {ASSISTANT.subtitle}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={{ border: 'none', background: 'rgba(255,255,255,.16)', color: '#fff', height: 30, width: 30, borderRadius: 8, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', background: C.cream }}>
            {messages.length === 0 && (
              <div style={{ animation: 'rg-pop .3s ease' }}>
                <div style={{ background: C.paper, border: `1px solid ${C.border}`, borderRadius: '4px 16px 16px 16px', padding: '12px 14px', fontSize: 14.5, color: C.brown, lineHeight: 1.5, boxShadow: '0 4px 14px var(--rg-bubble-shadow)' }}>
                  {ASSISTANT_GREETING}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {QUICK.map((q) => (<button key={q} className="rg-chip" onClick={() => send(q)} style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, cursor: 'pointer', transition: 'all .15s ease' }}>{q}</button>))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (!m.content) return null;
              const isUser = m.role === 'user';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '10px 0' }}>
                  <div style={{ maxWidth: '84%', padding: '10px 13px', fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px', background: isUser ? `linear-gradient(135deg, ${C.ctaFrom}, ${C.ctaTo})` : C.paper, color: isUser ? 'var(--cta-fg)' : C.brown, border: isUser ? 'none' : `1px solid ${C.border}`, boxShadow: isUser ? '0 4px 14px rgba(168,95,46,.22)' : '0 4px 14px var(--rg-bubble-shadow)' }}>{m.content}</div>
                </div>
              );
            })}

            {waiting && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '10px 0' }}>
                <div style={{ padding: '12px 14px', background: C.paper, border: `1px solid ${C.border}`, borderRadius: '4px 16px 16px 16px' }}>
                  <span className="rg-dot" /><span className="rg-dot" style={{ animationDelay: '.18s' }} /><span className="rg-dot" style={{ animationDelay: '.36s' }} />
                </div>
              </div>
            )}

            {/* Error card was #a23a2a on #fbeeea — a pale pink surface that stayed
                pale in dark mode. Tokenised so the error state flips with the theme. */}
            {errored && (
              <div style={{ margin: '10px 0', fontSize: 13, color: 'var(--danger-fg)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 12, padding: '10px 12px' }}>
                Something hiccuped on my end. Try again, or call <strong>(647)&nbsp;244-5156</strong>.
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, background: C.paper, padding: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)} placeholder="e.g. white oak, ~600 sqft, M4K…" style={{ flex: 1, border: `1px solid ${C.border}`, background: C.cream, borderRadius: 12, padding: '11px 13px', fontSize: 14, color: C.brown, outline: 'none' }} />
              <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send" style={{ height: 42, width: 42, borderRadius: 12, border: 'none', cursor: busy || !input.trim() ? 'default' : 'pointer', background: `linear-gradient(135deg, ${C.bronze}, ${C.bronzeDark})`, opacity: busy || !input.trim() ? 0.5 : 1, display: 'grid', placeItems: 'center' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: 10.5, color: C.muted, marginTop: 7 }}>Estimates are guidance · Powered by Grimaldi Engineering</div>
          </div>
        </div>
      )}
    </>
  );
}
