'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, FocusEvent as ReactFocusEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
 * closes. Hover opens for a mouse only — a touch tap must not open and
 * immediately navigate, which is the classic mega-menu bug on phones. Every
 * link inside is a real anchor, so the whole tree is crawlable whether or not
 * the panel has ever been opened.
 */

/* The shape lives in lib/navigation.ts with the menus themselves (NAV-03), so
   the panel, the drawer and ⌘K cannot drift into three different ideas of what
   a menu column is. Re-exported here because this is where it was defined and
   an import of it from this path should keep working. */
export type { MegaColumn } from '@/lib/navigation';
import type { MegaColumn } from '@/lib/navigation';

/*
 * HOVER THAT A HUMAN CAN ACTUALLY FOLLOW (UI-NAV-01).
 *
 * The panel opened on mouseenter and closed on mouseleave of the wrapper, with
 * no delay. The trigger sits in the middle of a 72px bar and the panel hangs
 * from the BOTTOM of the bar, so between the two there is a band of header that
 * belongs to neither. Moving the pointer down from "Services" to the first link
 * crossed that band, fired mouseleave, and the panel vanished under the cursor
 * before it arrived. Nobody could reach a link except by clicking the trigger,
 * and clicking a hover-opened trigger TOGGLED it — closed. That is the report,
 * in full: "it disappears by itself and I cannot click the dropdown".
 *
 * What replaces it is the behaviour of every mega-menu that works:
 *
 *   · a close DELAY. Leaving starts a timer; coming back into the trigger, the
 *     band or the panel cancels it. The pointer can take a diagonal, slow path.
 *   · a hover BRIDGE (.mm-bridge in globals.css) that fills the band, so
 *     the pointer is never actually outside the menu on the way down.
 *   · ONE PANEL AT A TIME. Sliding from Services to Library swaps immediately
 *     instead of stacking two panels for the length of the close delay.
 *   · CLICK PINS. A click on the trigger opens the panel and keeps it open until
 *     an outside click, Escape, the close button or a link; a click on a panel
 *     that hover already opened pins it rather than closing it.
 *   · touch never hovers: pointerType is checked, not guessed from the viewport.
 */
const OPEN_DELAY = 70;
const CLOSE_DELAY = 350;
const OPEN_EVENT = 'ecw:mega-open';
let activeMenu: string | null = null;

/**
 * The four routes with a real conversion path behind them get prefetched the
 * instant a pointer enters their link, not after Next's default viewport
 * IntersectionObserver notices they became visible (which, for a link inside
 * a menu panel, only fires once the panel has already finished opening —
 * later than a hover has already committed). Every other link in this menu
 * keeps the default: forty-plus routes prefetching on pointer-enter would be
 * bandwidth spent on destinations nobody asked for.
 */
const EAGER_PREFETCH_TARGETS = new Set([
  '/library',
  '/hardwood-color-matching-toronto',
  '/hardwood-stairs-toronto',
  '/hardwood-flooring-toronto',
]);

export function MegaMenu({
  label,
  id,
  columns,
  footer,
  layout,
}: {
  label: string;
  id: string;
  columns: MegaColumn[];
  footer?: { label: string; href: string };
  /**
   * Visual columns, each a list of column titles stacked top to bottom. Six
   * groups in an auto-fit grid wrapped to five plus one orphan row with a
   * screen of empty space beside it; the layout says where each group goes.
   * The mobile drawer reads `columns` in their own order and ignores this.
   */
  layout?: string[][];
}) {
  const router = useRouter();
  const prefetchOnEnter = (href: string) => {
    if (EAGER_PREFETCH_TARGETS.has(href)) router.prefetch(href);
  };
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const show = (pin: boolean) => {
    clearTimer();
    setOpen(true);
    if (pin) setPinned(true);
    activeMenu = id;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
  };
  const hide = () => {
    clearTimer();
    setOpen(false);
    setPinned(false);
    if (activeMenu === id) activeMenu = null;
  };

  /* One panel at a time. */
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) {
        clearTimer();
        setOpen(false);
        setPinned(false);
      }
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOther);
      clearTimer();
    };
  }, [id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { hide(); trigger.current?.focus(); }
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isMouse = (e: ReactPointerEvent) => e.pointerType === 'mouse' || e.pointerType === 'pen';

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (!isMouse(e)) return;
    clearTimer();
    if (open) return;
    /* Sliding across from the other panel: swap now. From the page: a short
       intent delay, so a pointer passing over the bar does not flash a panel. */
    if (activeMenu && activeMenu !== id) show(false);
    else timer.current = window.setTimeout(() => show(false), OPEN_DELAY);
  };
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (!isMouse(e)) return;
    clearTimer();
    if (pinned) return;
    timer.current = window.setTimeout(hide, CLOSE_DELAY);
  };

  /* Keyboard: leaving the whole menu with Tab closes it. */
  const onBlur = (e: ReactFocusEvent) => {
    if (wrap.current && e.relatedTarget && !wrap.current.contains(e.relatedTarget as Node)) hide();
  };

  const onTriggerClick = () => {
    if (!open) show(true);
    else if (!pinned) setPinned(true);
    else hide();
  };

  const stacks: MegaColumn[][] = layout
    ? layout
        .map((titles) => titles.map((t) => columns.find((c) => c.title === t)).filter((c): c is MegaColumn => Boolean(c)))
        .filter((s) => s.length > 0)
    : columns.map((c) => [c]);

  return (
    <div className="mm" ref={wrap} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
      <button
        type="button"
        ref={trigger}
        className={`mm-trigger ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls={`mm-${id}`}
        onClick={onTriggerClick}
      >
        {label}
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && <span className="mm-bridge" aria-hidden="true" />}
      <div id={`mm-${id}`} className="mm-panel" hidden={!open}>
        <div className="mm-panel-inner">
          {/* Escape closed this panel and outside-click closed it, and neither
              is visible. On a touchscreen — where there is no hover to leave and
              no keyboard in reach — the only way out was to tap the trigger
              again, which is a thing people have to be taught. A visible control
              is the affordance the mobile drawer already had. */}
          <button
            type="button"
            className="mm-close"
            onClick={() => { hide(); trigger.current?.focus(); }}
            aria-label={`Close the ${label} menu`}
          >
            ✕
          </button>
          <div className="mm-cols" data-cols={stacks.length}>
            {stacks.map((stack) => (
              <div className="mm-stack" key={stack.map((c) => c.title).join('|')}>
                {stack.map((col) => (
                  <div className="mm-col" key={col.title}>
                    <p className="mm-col-title">
                      {col.href ? (
                        <Link href={col.href} onClick={hide} onPointerEnter={() => prefetchOnEnter(col.href!)}>
                          {col.title}
                        </Link>
                      ) : (
                        col.title
                      )}
                    </p>
                    <ul>
                      {col.items.map((it) => (
                        <li key={`${it.href}|${it.label}`}>
                          <Link href={it.href} onClick={hide} onPointerEnter={() => prefetchOnEnter(it.href)}>
                            <span className="mm-label">{it.label}</span>
                            {it.note && <span className="mm-note">{it.note}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {footer && (
            <Link className="mm-footer" href={footer.href} onClick={hide}>
              {footer.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
