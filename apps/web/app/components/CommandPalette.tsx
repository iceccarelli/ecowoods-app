'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openRenoGuide } from '@/lib/renoguide';
import { useTheme } from './useTheme';
import { EcowoodsLeaf } from './EcowoodsLeaf';

/* ────────────────────────────────────────────────────────────────────────────
   ⌘K — for the 4% of visitors who type instead of scroll.

   Deliberately opinionated: the highest-value rows are not navigation, they
   are the three questions that precede a booking. Each one drops the visitor
   straight into RenoGuide with the question already asked, so the very first
   thing the agent does is call a real tool.
   ──────────────────────────────────────────────────────────────────────────── */

type Action = {
  id: string;
  title: string;
  hint?: string;
  tag?: string;
  keywords: string;
  icon: React.ReactNode;
  run: () => void;
};

type Group = { label: string; actions: Action[] };

const I = {
  chat: <EcowoodsLeaf size={20} strokeWidth={1.7} fillOpacity={0.22} />,
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  ),
  calc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01" strokeLinecap="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M3 5a2 2 0 0 1 2-2h2.3a1 1 0 0 1 .9.7l1.5 4.4a1 1 0 0 1-.5 1.2l-1.8 1a13 13 0 0 0 6.3 6.3l1-1.8a1 1 0 0 1 1.2-.5l4.4 1.5a1 1 0 0 1 .7.9V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z" strokeLinejoin="round" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" strokeLinecap="round" />
    </svg>
  ),
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD');

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const { theme, toggle } = useTheme();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    restoreFocus.current?.focus();
  }, []);

  const go = useCallback((hash: string) => () => {
    close();
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${hash}`);
  }, [close]);

  const ask = useCallback((prefill: string) => () => {
    close();
    openRenoGuide({ prefill, source: 'command-palette' });
  }, [close]);

  const groups: Group[] = useMemo(() => [
    {
      label: 'Talk to RenoGuide',
      actions: [
        { id: 'book', title: 'Book a free in-home measure', hint: 'RenoGuide checks real openings and confirms it', tag: 'AI', keywords: 'book appointment measure estimate schedule visit', icon: I.calendar,
          run: ask('I would like to book a free in-home measure. What times are open?') },
        { id: 'estimate', title: 'Get a ballpark for my floor', hint: 'Tell it species and square footage', tag: 'AI', keywords: 'price cost estimate quote ballpark how much', icon: I.calc,
          run: ask('Can you give me a ballpark for hardwood in my home?') },
        { id: 'species', title: 'Which species survives kids and dogs?', tag: 'AI', keywords: 'species hardness janka pets dogs kids durable oak hickory', icon: I.chat,
          run: ask('Which hardwood species holds up best with kids and a large dog?') },
        { id: 'chat', title: 'Open RenoGuide', hint: 'Just start typing', keywords: 'chat assistant ai help renoguide', icon: I.chat,
          run: () => { close(); openRenoGuide({ source: 'command-palette' }); } },
      ],
    },
    {
      label: 'Design',
      actions: [
        { id: 'configurator', title: 'Design your floor', hint: 'Species, finish, pattern — live pricing', keywords: 'configurator design build customize herringbone chevron finish', icon: I.arrow, run: go('configurator') },
        { id: 'gallery', title: 'See finished Toronto projects', keywords: 'gallery portfolio work photos results', icon: I.arrow, run: go('gallery') },
      ],
    },
    {
      label: 'Navigate',
      actions: [
        { id: 'services', title: 'Services', keywords: 'services install refinish sanding stairs inlay commercial', icon: I.arrow, run: go('services') },
        { id: 'process', title: 'How it works', keywords: 'process steps how it works funnel', icon: I.arrow, run: go('process') },
        { id: 'reviews', title: 'Reviews', keywords: 'reviews testimonials proof clients', icon: I.arrow, run: go('reviews') },
        { id: 'faq', title: 'FAQ', keywords: 'faq questions warranty dust price fixed', icon: I.arrow, run: go('faq') },
        { id: 'quote', title: 'Request a free estimate', keywords: 'quote contact estimate form request', icon: I.arrow, run: go('quote') },
      ],
    },
    {
      label: 'Contact & appearance',
      actions: [
        { id: 'call', title: 'Call (647) 244-5156', hint: 'Mon–Sat · 8 AM – 7 PM', keywords: 'call phone telephone ring speak human', icon: I.phone,
          run: () => { close(); window.location.href = 'tel:+16472445156'; } },
        { id: 'theme', title: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', hint: 'Night showroom', keywords: 'theme dark light mode night appearance', icon: I.sun,
          run: () => { toggle(); close(); } },
      ],
    },
  ], [ask, go, close, theme, toggle]);

  const filtered: Group[] = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, actions: g.actions.filter((a) => norm(`${a.title} ${a.keywords}`).includes(q)) }))
      .filter((g) => g.actions.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => filtered.flatMap((g) => g.actions), [filtered]);

  useEffect(() => { setActive(0); }, [query]);

  // Global hotkey. Ignore when the visitor is typing somewhere real.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
      if (!isK) return;
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing && !open) return;
      e.preventDefault();
      setOpen((v) => {
        if (!v) restoreFocus.current = document.activeElement as HTMLElement;
        return !v;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock scroll + focus the input.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => { document.body.style.overflow = prev; clearTimeout(t); };
  }, [open]);

  // Keep the active row in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); return; }
    if (e.key === 'Home')      { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End')       { e.preventDefault(); setActive(Math.max(0, flat.length - 1)); return; }
    if (e.key === 'Enter')     { e.preventDefault(); flat[active]?.run(); }
  };

  let cursor = -1;

  return (
    <>
      <button
        type="button"
        className="cmdk-trigger"
        onClick={() => { restoreFocus.current = document.activeElement as HTMLElement; setOpen(true); }}
        aria-label="Open command palette"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="cmdk-trigger-label">Search</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className="cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
          >
            <div className="cmdk-search">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Book a measure, price a floor, jump anywhere…"
                role="combobox"
                aria-expanded="true"
                aria-controls="cmdk-list"
                aria-autocomplete="list"
                aria-activedescendant={flat[active] ? `cmdk-opt-${flat[active].id}` : undefined}
              />
            </div>

            <div className="cmdk-list" id="cmdk-list" role="listbox" aria-label="Commands" ref={listRef}>
              {flat.length === 0 && (
                <div className="cmdk-empty">
                  Nothing matches “{query}”. <button className="fc-secondary" style={{ marginTop: '0.9rem' }} onClick={ask(query)}>Ask RenoGuide instead →</button>
                </div>
              )}

              {filtered.map((group) => (
                <div key={group.label}>
                  <div className="cmdk-group-label">{group.label}</div>
                  {group.actions.map((a) => {
                    cursor += 1;
                    const idx = cursor;
                    return (
                      <button
                        key={a.id}
                        id={`cmdk-opt-${a.id}`}
                        role="option"
                        aria-selected={idx === active}
                        data-active={idx === active}
                        className="cmdk-item"
                        onMouseMove={() => setActive(idx)}
                        onClick={a.run}
                      >
                        <span className="cmdk-item-icon">{a.icon}</span>
                        <span className="cmdk-item-body">
                          <span className="cmdk-item-title">{a.title}</span>
                          {a.hint && <span className="cmdk-item-hint">{a.hint}</span>}
                        </span>
                        {a.tag && <span className="cmdk-item-tag">{a.tag}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cmdk-footer">
              <span><kbd>↑↓</kbd>navigate</span>
              <span><kbd>↵</kbd>select</span>
              <span><kbd>esc</kbd>close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
