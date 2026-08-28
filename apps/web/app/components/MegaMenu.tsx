'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * MegaMenu — the AWS "Products ▾" pattern, and the single biggest structural
 * fix available to this site.
 *
 * THE PROBLEM IT SOLVES
 *
 * Two independent audits scored information architecture 5/10 and 6/10, and
 * both gave the same reason: `/resources`, `/technical-library`, `/papers`,
 * `/guides`, `/library`, `/data`, `/framework` and `/authority` all compete to
 * be "the library", while the five commercial pages sat in the footer. This
 * company has five sourced papers, sixteen guides, forty-four glossary terms,
 * nine standards and a public knowledge API, and a visitor could not see that
 * any of it existed without guessing which hub to open.
 *
 * AWS has the same shape of problem at a thousand times the scale — 240+
 * services — and solves it with two dropdown panels that show the whole tree at
 * once, grouped by what someone came to do. Not a link to a hub. The tree.
 *
 * WHY A PANEL BEATS ANOTHER HUB PAGE
 *
 * A hub page costs a click to discover that a click was wasted. A panel answers
 * "does this site have what I need" before the visitor spends anything. That is
 * the entire mechanism, and it is why AWS's nav is a menu rather than a page.
 *
 * ACCESSIBILITY, WHICH IS WHERE MOST MEGA-MENUS FAIL
 *
 * The trigger is a real <button> with aria-expanded and aria-controls, not a
 * div with a mouse handler. Escape closes and returns focus. Click-outside
 * closes. Hover opens on a pointer device only — a touch tap must not open and
 * immediately navigate, which is the classic mega-menu bug on phones. Every
 * link inside is a real anchor, so the whole tree is crawlable whether or not
 * the panel has ever been opened.
 */

export type MegaColumn = {
  title: string;
  /** Where the column heading itself goes. Optional — some columns are lists only. */
  href?: string;
  items: { label: string; href: string; note?: string }[];
};

export function MegaMenu({
  label,
  id,
  columns,
  footer,
}: {
  label: string;
  id: string;
  columns: MegaColumn[];
  footer?: { label: string; href: string };
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  /* Hover opens on a pointer device only. On a touchscreen the first tap must
     open the panel and nothing else; a hover-open there fires and closes in the
     same gesture, which is why so many mega-menus are unusable on a phone. */
  const pointerProps = {
    onMouseEnter: () => { if (window.matchMedia('(hover: hover)').matches) setOpen(true); },
    onMouseLeave: () => { if (window.matchMedia('(hover: hover)').matches) setOpen(false); },
  };

  return (
    <div className="mm" ref={wrap} {...pointerProps}>
      <button
        type="button"
        ref={trigger}
        className={`mm-trigger ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls={`mm-${id}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div id={`mm-${id}`} className="mm-panel" hidden={!open}>
        <div className="mm-panel-inner">
          <div className="mm-cols">
            {columns.map((col) => (
              <div className="mm-col" key={col.title}>
                <p className="mm-col-title">
                  {col.href ? <Link href={col.href} onClick={() => setOpen(false)}>{col.title}</Link> : col.title}
                </p>
                <ul>
                  {col.items.map((it) => (
                    <li key={it.href}>
                      <Link href={it.href} onClick={() => setOpen(false)}>
                        <span className="mm-label">{it.label}</span>
                        {it.note && <span className="mm-note">{it.note}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {footer && (
            <Link className="mm-footer" href={footer.href} onClick={() => setOpen(false)}>
              {footer.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
