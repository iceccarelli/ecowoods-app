'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { EW_MARK, EW_MARK_ALT } from '@/lib/brand';
import {
  WORKSPACE_ASSISTANT,
  WORKSPACE_GREETING,
  WORKSPACE_RENOVATION_CHIPS,
  WORKSPACE_COMPOSER_PLACEHOLDER,
} from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { selectionIncompatibilities } from '@/lib/assistant-workspace/recommendations';
import { projectRangeForState } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import { computeEarnedCatalog, type EarnedCatalog } from '@/lib/assistant-workspace/earned-catalog';
import type { AssistantChatCard, AssistantChatResponse } from '@/lib/assistant-workspace/chat-schema';
import type { WorkspacePatch, WorkspaceState } from '@/lib/assistant-workspace/types';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { ProductCard } from './ProductCard';
import { ServiceCard } from './ServiceCard';
import { ConversionPanel } from './ConversionPanel';
import { RenovationAnalysisOffer } from './RenovationAnalysisOffer';
import { ANALYSIS_CREDIT_COST } from '@/lib/assistant-workspace/credits-config';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
  cards?: AssistantChatCard[];
  /**
   * Contextual "Worth considering" / "Services" cards, computed ONLY for the
   * turn that actually changed floor-relevant state (objective, targetFloor,
   * selectedServiceSlugs, stairs) — never a standing catalogue that survives
   * into an unrelated later turn (e.g. "roof vs kitchen vs floors"). Tied to
   * this specific message so it renders once, with the answer that earned
   * it, and never resurfaces on a later, unrelated reply.
   */
  earnedCatalog?: EarnedCatalog;
  /** True only for a genuine send failure (network/5xx) — renders the retry affordance, never for a degraded-but-understood reply. */
  failed?: boolean;
}

/**
 * The link CTA reads as the homeowner's goal, not the implementation
 * ("Open"). Directive rule 22 — "Add to project" (and a generic "Open") are
 * implementation actions; a person thinks in terms of see/understand/book.
 */
function cardLinkLabel(type: AssistantChatCard['type']): string {
  switch (type) {
    case 'site_link':
      return 'See this page';
    case 'conversion_proposed':
      return 'Review in Next step';
    case 'pending_provider':
      return 'Learn what is available now';
    case 'ecowoods_band':
    default:
      return 'See the published band';
  }
}

/** Presentation-only: mobile keeps the composer placeholder short, per spec. */
const COMPOSER_PLACEHOLDER_MOBILE = `${WORKSPACE_ASSISTANT.name}…`;

/** Start screen: 3–4 starters only (v8). */
const START_CHIPS = WORKSPACE_RENOVATION_CHIPS.slice(0, 4);

function snapshotFromState(state: WorkspaceState) {
  return {
    designId: state.designId || undefined,
    country: state.country,
    objective: state.objective,
    sellHorizon: state.sellHorizon,
    stairs: state.stairs,
    rooms: state.rooms,
    targetFloor: state.targetFloor,
    selectedServiceSlugs: state.selectedServiceSlugs,
    nextAction: state.nextAction,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function coercePatch(raw: unknown): WorkspacePatch {
  if (!isRecord(raw)) return {};
  const patch: WorkspacePatch = {};
  if (
    raw.objective === null ||
    raw.objective === 'install' ||
    raw.objective === 'refinish' ||
    raw.objective === 'repair' ||
    raw.objective === 'not-sure'
  ) {
    patch.objective = raw.objective;
  }
  if (
    raw.sellHorizon === null ||
    raw.sellHorizon === 'staying' ||
    raw.sellHorizon === 'selling-soon' ||
    raw.sellHorizon === 'not-sure'
  ) {
    patch.sellHorizon = raw.sellHorizon;
  }
  if (typeof raw.stairs === 'boolean') patch.stairs = raw.stairs;
  if (raw.country === 'CA' || raw.country === 'US') patch.country = raw.country;
  if (raw.nextAction === null || raw.nextAction === 'measure' || raw.nextAction === 'estimate' || raw.nextAction === 'quote') {
    patch.nextAction = raw.nextAction;
  }
  if (isRecord(raw.targetFloor)) {
    const tf: WorkspacePatch['targetFloor'] = {};
    if (typeof raw.targetFloor.productId === 'string') tf.productId = raw.targetFloor.productId;
    if (typeof raw.targetFloor.finishId === 'string') tf.finishId = raw.targetFloor.finishId;
    if (typeof raw.targetFloor.patternId === 'string') tf.patternId = raw.targetFloor.patternId;
    if (typeof raw.targetFloor.widthId === 'string') tf.widthId = raw.targetFloor.widthId;
    if (Object.keys(tf).length) patch.targetFloor = tf;
  }
  if (Array.isArray(raw.rooms)) {
    patch.rooms = raw.rooms
      .filter((r): r is { label: string; squareFeet?: number } => isRecord(r) && typeof r.label === 'string')
      .map((r) => ({
        label: r.label.slice(0, 80),
        ...(typeof r.squareFeet === 'number' ? { squareFeet: r.squareFeet } : {}),
      }));
  }
  if (Array.isArray(raw.selectedServiceSlugs)) {
    patch.selectedServiceSlugs = raw.selectedServiceSlugs.filter((s): s is string => typeof s === 'string');
  }
  if (Array.isArray(raw.pendingQuestions)) {
    patch.pendingQuestions = raw.pendingQuestions.filter((q): q is string => typeof q === 'string');
  }
  return patch;
}

/**
 * ConversationPane — conversation-first canvas (AGENT_DIRECTIVE v8).
 *
 * Start screen: Ask Francisco + one sentence + 3–4 starters. No "How this
 * works" wall. Cards and ConversionPanel appear only when earned. Rails live
 * in WorkspaceContextDrawer, not beside this pane.
 *
 * Model path: POST /api/assistant/chat. Corner /api/chat untouched.
 */
export function ConversationPane({
  evidencePool,
  onOpenProject,
  onOpenEconomics,
}: {
  evidencePool: CaseStudyEvidence[];
  onOpenProject?: () => void;
  onOpenEconomics?: () => void;
}) {
  const { state, patch } = useWorkspaceState();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /*
   * Returning from Stripe Checkout. The redirect itself proves nothing — the
   * webhook is the authority on whether credits were granted (directive:
   * "payment success is not success"). This polls the wallet a few times
   * (the webhook can lag the redirect by a second or two) rather than
   * trusting `credits_purchase=success` on its own, then narrates the real
   * balance and cleans the URL so a refresh doesn't re-trigger it.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('credits_purchase');
    if (!purchase) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (purchase === 'cancelled') {
      setMessages((prev) => [...prev, { role: 'assistant', text: "No problem — checkout was cancelled. Nothing was charged." }]);
      return;
    }
    let attempts = 0;
    const poll = () => {
      attempts += 1;
      fetch('/api/assistant/credits/wallet')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { balance: number } | null) => {
          if (data && data.balance > 0) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', text: `Your Renovation Credits are ready — you have ${data.balance}. Ask me for the analysis whenever you're ready.` },
            ]);
          } else if (attempts < 5) {
            setTimeout(poll, 1500);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', text: "Payment is processing — this can take a moment. Refresh in a bit and your credits will be there." },
            ]);
          }
        })
        .catch(() => undefined);
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Presentation-only viewport check for the shorter mobile placeholder —
     never affects layout logic, just which string the input shows. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  /* Auto-grow the composer textarea up to a capped height instead of a
     fixed-height single-line input, and keep the caret's row visible. */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [draft]);

  /* Follow the conversation as new turns arrive — a world-class assistant
     never makes the visitor scroll to see their own message land. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const incompatibilities = useMemo(() => selectionIncompatibilities(state), [state]);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  /** A real, unresolved incompatibility in the full selection — a safety warning, not a sales card. */
  const showIncompatibilities = Boolean(state.objective && messages.length > 0 && incompatibilities.length > 0);
  /** Primary next action: conversion when scope is ready or already proposed. */
  const showPrimaryNext = projectRange.status === 'ready' || Boolean(state.nextAction);

  const keywordFallback = (trimmed: string): DisplayMessage => {
    const { patch: next, understood } = interpretMessage(trimmed);
    if (Object.keys(next).length) patch(next);
    return {
      role: 'assistant',
      text: understood.length
        ? `Got it — added to this project: ${understood.join('; ')}. Open Project for the full picture.`
        : "I didn't catch a project detail yet, and the live advisor is briefly unavailable. Try a neighbourhood, a trade, or square footage — or ask again in a moment.",
    };
  };

  const respond = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const prior = messages;
    const userTurn: DisplayMessage = { role: 'user', text: trimmed };
    const history = [...prior, userTurn];
    setMessages(history);
    setDraft('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          workspace: snapshotFromState(state),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        /* A real server-side failure, not a degraded reply — the honest,
           billing-safe error state, not a silent keyword guess. */
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: "I couldn't complete that analysis. Nothing was charged.", failed: true },
        ]);
        return;
      }

      const data = (await res.json()) as AssistantChatResponse;
      const nextPatch = coercePatch(data.patch);
      if (Object.keys(nextPatch).length) patch(nextPatch);

      const { patch: keywordPatch } = interpretMessage(trimmed);
      if (Object.keys(keywordPatch).length) patch(keywordPatch);

      /*
       * Earned catalogue — computed ONLY when THIS turn's patch actually
       * touched a floor-relevant field. A question this turn didn't answer
       * ("roof vs kitchen vs floors?") never resurfaces last turn's floor
       * products just because `state.objective` happens to be set from
       * earlier in the conversation. See earned-catalog.ts.
       */
      const combinedPatch: WorkspacePatch = { ...nextPatch, ...keywordPatch };
      const earnedCatalog = computeEarnedCatalog(state, combinedPatch);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : keywordFallback(trimmed).text,
          cards: Array.isArray(data.cards) ? data.cards.slice(0, 2) : undefined,
          earnedCatalog,
        },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        /* Visitor pressed Stop — not an error, no retry affordance. */
        setMessages((prev) => [...prev, { role: 'assistant', text: 'Stopped.' }]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: "I couldn't complete that analysis. Nothing was charged.", failed: true },
      ]);
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const stopGenerating = () => abortRef.current?.abort();

  /** Retry: drop the failed placeholder and the user turn that failed no longer exists in `messages`'s copy — resend the same text as a fresh turn. */
  const retry = (failedIndex: number) => {
    const priorUser = [...messages].slice(0, failedIndex).reverse().find((m) => m.role === 'user');
    if (!priorUser) return;
    setMessages((prev) => prev.slice(0, failedIndex));
    void respond(priorUser.text);
  };

  const onAddProduct = (productId: string) => patch({ targetFloor: { productId } });
  const onAddService = (slug: string) => {
    if (state.selectedServiceSlugs.includes(slug)) return;
    patch({ selectedServiceSlugs: [...state.selectedServiceSlugs, slug] });
  };

  return (
    <section className="aha-conversation aha-conversation--canvas" aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}>
      <div className="aha-conversation-scroll" ref={scrollRef}>
        {!messages.length ? (
          <div className="aha-start">
            <span className="aha-avatar aha-avatar--start" aria-hidden="true">
              <Image src={EW_MARK} alt="" width={40} height={40} />
            </span>
            <p className="aha-start-name">{WORKSPACE_ASSISTANT.name}</p>
            <p className="aha-start-lede">{WORKSPACE_GREETING}</p>
            <div className="aha-chips" role="group" aria-label="Starter prompts">
              {START_CHIPS.map((chip) => (
                <button key={chip} type="button" className="aha-chip" onClick={() => void respond(chip)} disabled={busy}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`aha-message aha-message--${m.role}${m.failed ? ' aha-message--failed' : ''}`}>
                {m.role === 'assistant' && (
                  <span className="aha-avatar" aria-hidden="true">
                    <Image src={EW_MARK} alt={EW_MARK_ALT} width={24} height={24} />
                  </span>
                )}
                <div className="aha-message-body">
                  <p className="aha-message-author">{m.role === 'assistant' ? WORKSPACE_ASSISTANT.name : 'You'}</p>
                  <p className="aha-message-text">{m.text}</p>
                  {m.failed && (
                    <button type="button" className="aha-message-retry" onClick={() => retry(i)}>
                      Try again
                    </button>
                  )}
                  {m.cards && m.cards.length > 0 && (
                    <ul className="aha-inline-cards">
                      {m.cards.map((c, j) =>
                        c.type === 'renovation_analysis_offer' ? (
                          <RenovationAnalysisOffer
                            key={j}
                            creditsCost={c.creditsCost ?? ANALYSIS_CREDIT_COST}
                            workspaceSnapshot={snapshotFromState(state)}
                          />
                        ) : (
                          <li key={j} className="aha-inline-card" data-card-type={c.type}>
                            <p className="aha-inline-card-title">{c.title}</p>
                            <p className="aha-inline-card-body">{c.body}</p>
                            {c.href ? (
                              <a className="aha-inline-card-link" href={c.href} target="_blank" rel="noopener noreferrer">
                                {cardLinkLabel(c.type)}
                              </a>
                            ) : null}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                  {m.earnedCatalog && (m.earnedCatalog.products.length > 0 || m.earnedCatalog.services.length > 0) && (
                    <div className="aha-earned">
                      {m.earnedCatalog.products.length > 0 && (
                        <>
                          <p className="aha-recommended-heading">Worth considering</p>
                          <div className="aha-card-grid aha-card-grid--compact">
                            {m.earnedCatalog.products.map((rec) => (
                              <ProductCard key={rec.product.id} recommendation={rec} onAdd={onAddProduct} />
                            ))}
                          </div>
                        </>
                      )}
                      {m.earnedCatalog.services.length > 0 && (
                        <>
                          <p className="aha-recommended-heading">Services</p>
                          <div className="aha-card-grid aha-card-grid--compact">
                            {m.earnedCatalog.services.map((rec) => (
                              <ServiceCard key={rec.service.slug} recommendation={rec} onAdd={onAddService} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="aha-message aha-message--assistant" aria-live="polite">
                <span className="aha-avatar" aria-hidden="true">
                  <Image src={EW_MARK} alt="" width={24} height={24} />
                </span>
                <div className="aha-message-body">
                  <p className="aha-message-author">{WORKSPACE_ASSISTANT.name}</p>
                  <p className="aha-message-text aha-typing">
                    <span className="aha-typing-label">Francisco is working through that</span>
                    <span className="aha-typing-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </p>
                  <button type="button" className="aha-message-retry aha-message-stop" onClick={stopGenerating}>
                    Stop
                  </button>
                </div>
              </div>
            )}

            {(onOpenProject || onOpenEconomics) && state.objective && (
              <div className="aha-context-hints">
                {onOpenProject && (
                  <button type="button" className="aha-context-hint" onClick={onOpenProject}>
                    View project
                  </button>
                )}
                {onOpenEconomics && (projectRange.status === 'ready' || valueScenario.status === 'ready') && (
                  <button type="button" className="aha-context-hint" onClick={onOpenEconomics}>
                    View economics
                  </button>
                )}
              </div>
            )}

            {showIncompatibilities && (
              <div className="aha-incompatibility" role="alert">
                {incompatibilities.map((i) => (
                  <p key={i.axis}>{i.reason}</p>
                ))}
              </div>
            )}

            {showPrimaryNext && (
              <div className="aha-primary-next" id="aha-next-step">
                <p className="aha-recommended-heading">Next step</p>
                <ConversionPanel projectRange={projectRange} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="aha-composer-bar">
      <form
        className="aha-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void respond(draft);
        }}
        aria-label={`Message ${WORKSPACE_ASSISTANT.name}`}
      >
        <textarea
          ref={textareaRef}
          className="aha-composer-input"
          placeholder={isNarrow ? COMPOSER_PLACEHOLDER_MOBILE : WORKSPACE_COMPOSER_PLACEHOLDER}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            /* Enter sends; Shift+Enter (or any IME composition) inserts a newline. */
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void respond(draft);
            }
          }}
          aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}
          disabled={busy}
          rows={1}
          autoFocus
        />
        <button
          type="submit"
          className="aha-composer-send"
          disabled={!draft.trim() || busy}
          aria-label={`Send message to ${WORKSPACE_ASSISTANT.name}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 19V5M12 5l-6 6M12 5l6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      </div>
    </section>
  );
}
