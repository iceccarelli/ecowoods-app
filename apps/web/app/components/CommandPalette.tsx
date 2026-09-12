'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openAssistant } from '@/lib/assistant';
import { useTheme } from './useTheme';
import { EcowoodsLeaf } from './EcowoodsLeaf';
import { BUSINESS_NAP, HOURS_LINE } from '@ecowoods/shared/constants';
import { isTypingTarget } from '@/lib/keyboard';
import { ASSISTANT } from '@/lib/assistant-identity';
import { DESTINATIONS, type Destination } from '@/lib/navigation';

/* ────────────────────────────────────────────────────────────────────────────
   ⌘K — for the 4% of visitors who type instead of scroll.

   Deliberately opinionated: the highest-value rows are not navigation, they
   are the three questions that precede a booking. Each one drops the visitor
   straight into EcowoodsGuide with the question already asked, so the very first
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

/**
 * OPEN ⌘K FROM SOMEWHERE THAT IS NOT ⌘K (ASSIST-01).
 *
 * The palette had exactly two ways in: the keyboard shortcut, and its own
 * trigger in the header bar. Both disappear on a small phone — the trigger is
 * hidden below 379px to leave room for the brand and the hamburger, and a
 * phone has no ⌘. So on an iPhone SE, and on most Android handsets held in one
 * hand, the search that reaches all fifty-five destinations on this site could
 * not be opened at all.
 *
 * AWS puts search in the drawer for the same reason. This is the door the
 * drawer knocks on: a window event rather than a prop, because the drawer lives
 * in Header and the palette is Header's own child, and threading a ref through
 * a hamburger to do it would be worse than one line of DOM.
 */
export const OPEN_PALETTE_EVENT = 'ecowoods:open-palette';

export function openCommandPalette(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

/**
 * What ⌘K offers before a single key is pressed.
 *
 * Six hrefs, in the order a visitor's intent usually runs: see it, specify it,
 * what it costs, where we go, is my quote fair, get the price in writing. They
 * are hrefs and not rows — the label, the note and the existence of each one
 * come from lib/navigation.ts, so this list can never name a page the menus no
 * longer carry.
 */
const RESTING_HREFS = [
  '/floor-studio',
  '/design',
  '/pricing',
  '/service-areas',
  '/quote-check',
  '/estimate',
];

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

  /**
   * NAVIGATION THAT WORKS FROM SOMEWHERE OTHER THAN THE HOMEPAGE (NAV-03).
   *
   * This was `getElementById(hash)?.scrollIntoView()` followed, unconditionally,
   * by `history.replaceState(null, '', '#' + hash)`. Every id it looked for —
   * services, process, reviews, faq, quote, gallery — is rendered by
   * home-client.tsx and by nothing else. So on 46 of this site's 47 public
   * routes the optional chain swallowed a null, the page did not move, the
   * dialog closed, and the address bar was rewritten to a fragment that matched
   * nothing on it. Five of thirteen actions, silently dead, everywhere but one
   * page.
   *
   * `go` now takes a real href. If it carries a fragment AND that element is on
   * this page, it scrolls — which is the good behaviour the old one had on the
   * homepage, kept. Otherwise it navigates, because a destination the visitor
   * asked for out loud must not resolve to nothing happening.
   */
  const go = useCallback((href: string) => () => {
    close();
    const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    const path = href.includes('#') ? href.slice(0, href.indexOf('#')) : href;
    const here = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
    const samePage = !path || path.replace(/\/$/, '') === here;
    if (hash && samePage) {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${hash}`);
        return;
      }
    }
    window.location.assign(href);
  }, [close]);

  const ask = useCallback((prefill: string) => () => {
    close();
    openAssistant({ prefill, source: 'command-palette' });
  }, [close]);

  /**
   * The chrome's destinations, grouped by the column they came from.
   *
   * `keywords` is the label plus its note plus the path segments, which is what
   * makes "buffalo", "herringbone" or "chevron" find a page whose label says
   * none of those words. Derived, so it cannot go stale.
   */
  const paletteGroups: Group[] = useMemo(() => {
    const byGroup = new Map<string, Action[]>();
    for (const d of DESTINATIONS) {
      const list = byGroup.get(d.group) ?? [];
      list.push({
        id: `nav:${d.href}:${d.label}`,
        title: d.label,
        hint: d.note,
        keywords: `${d.label} ${d.note ?? ''} ${d.href.replace(/[/#-]+/g, ' ')}`,
        icon: I.arrow,
        run: go(d.href),
      });
      byGroup.set(d.group, list);
    }
    return [...byGroup.entries()].map(([label, actions]) => ({ label, actions }));
  }, [go]);

  const groups: Group[] = useMemo(() => [
    {
      label: `Talk to ${ASSISTANT.name}`,
      actions: [
        { id: 'book', title: 'Book a free in-home measure', hint: `${ASSISTANT.name} checks real openings and confirms it`, tag: 'AI', keywords: 'book appointment measure estimate schedule visit', icon: I.calendar,
          run: ask('I would like to book a free in-home measure. What times are open?') },
        { id: 'estimate', title: 'Get a ballpark for my floor', hint: 'Tell it species and square footage', tag: 'AI', keywords: 'price cost estimate quote ballpark how much', icon: I.calc,
          run: ask('Can you give me a ballpark for hardwood in my home?') },
        { id: 'species', title: 'Which species survives kids and dogs?', tag: 'AI', keywords: 'species hardness janka pets dogs kids durable oak hickory', icon: I.chat,
          run: ask('Which hardwood species holds up best with kids and a large dog?') },
        { id: 'chat', title: `Open ${ASSISTANT.name}`, hint: 'Just start typing', keywords: 'chat assistant ai help guide', icon: I.chat,
          run: () => { close(); openAssistant({ source: 'command-palette' }); } },
      ],
    },
    /* EVERY DESTINATION IN THE CHROME, DERIVED (NAV-03).
     *
     * What stood here was five hand-written rows naming homepage anchors, and a
     * sixth naming /design. It was written when this site was one page and it
     * was never revisited: by the time it was measured it could not reach Floor
     * Studio, /pricing, /service-areas, /corridors, /estimate, /guides, /papers,
     * /case-studies, /quote-check or /framework — the ten pages a visitor is
     * most likely to be hunting for when they reach for ⌘K in the first place.
     *
     * It is now projected from lib/navigation.ts, the same module the desktop
     * panels and the mobile drawer read. A page added to a menu is searchable
     * here the same commit, and cannot be forgotten here, because nobody has to
     * remember. Sections keep the menu's own column titles so the palette reads
     * as the site's structure rather than a flat dump. */
    ...paletteGroups,
    {
      label: 'Contact & appearance',
      actions: [
        { id: 'call', title: `Call ${BUSINESS_NAP.phoneDisplay}`, hint: HOURS_LINE, keywords: 'call phone telephone ring speak human', icon: I.phone,
          run: () => { close(); window.location.href = BUSINESS_NAP.phoneHref; } },
        { id: 'theme', title: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', hint: 'Night showroom', keywords: 'theme dark light mode night appearance', icon: I.sun,
          run: () => { toggle(); close(); } },
      ],
    },
  ], [ask, close, theme, toggle, paletteGroups]);

  /**
   * AN EMPTY PALETTE IS A MENU; A TYPED ONE IS A SEARCH (NAV-03).
   *
   * Projecting the whole chrome in makes ⌘K complete, and a complete list is
   * roughly fifty rows. Opening a dialog onto fifty rows is not a shortcut, it
   * is a sitemap with a text box, and it throws away the thing this component
   * was opinionated about: the first rows should be the three questions that
   * precede a booking, not navigation.
   *
   * So the resting state is short — the assistant, a handful of the highest
   * intent destinations, the phone — and the FIRST KEYSTROKE opens the whole
   * corpus. Nothing is unreachable; it is one character away. The shortlist is
   * selected BY HREF out of the derived set, so it carries the menu's own
   * labels and notes and cannot describe a page differently from the panel that
   * links it, or survive that page being removed.
   */
  const filtered: Group[] = useMemo(() => {
    const q = norm(query.trim());
    if (q) {
      return groups
        .map((g) => ({ ...g, actions: g.actions.filter((a) => norm(`${a.title} ${a.keywords}`).includes(q)) }))
        .filter((g) => g.actions.length > 0);
    }
    const byHref = new Map(DESTINATIONS.map((d) => [d.href, d]));
    const jump = RESTING_HREFS.map((h) => byHref.get(h)).filter((d): d is Destination => Boolean(d));
    const rest: Group = {
      label: 'Jump to',
      actions: jump.map((d) => ({
        id: `nav:${d.href}:${d.label}`,
        title: d.label,
        hint: d.note,
        keywords: d.label,
        icon: I.arrow,
        run: go(d.href),
      })),
    };
    const first = groups[0];
    const last = groups[groups.length - 1];
    return [
      ...(first ? [first] : []),
      ...(rest.actions.length ? [rest] : []),
      ...(last && last !== first ? [last] : []),
    ];
  }, [groups, query, go]);

  const flat = useMemo(() => filtered.flatMap((g) => g.actions), [filtered]);

  useEffect(() => { setActive(0); }, [query]);

  /* Opened from the mobile drawer, where neither the shortcut nor the trigger
     exists. Focus is restored to whatever asked for it, same as the trigger. */
  useEffect(() => {
    const onOpen = () => {
      restoreFocus.current = document.activeElement as HTMLElement;
      setOpen(true);
    };
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
  }, []);

  /* Global hotkey. Ignore when the visitor is typing somewhere real.
     This component had the check right — and hand-rolled, which is why it was
     also incomplete: it missed <select> and anything carrying role="textbox"
     or role="combobox". `isTypingTarget` from lib/keyboard.ts is the one
     definition of "is a person typing here", and it is the one the build guard
     enforces. The behaviour is unchanged: ⌘K is ignored inside a field unless
     the palette is already open, so it can always be used to close itself. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
      if (!isK) return;
      if (isTypingTarget(e.target) && !open) return;
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
                aria-label="Search this site"
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
                  Nothing matches “{query}”. <button className="fc-secondary" style={{ marginTop: '0.9rem' }} onClick={ask(query)}>Ask {ASSISTANT.name} instead →</button>
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
