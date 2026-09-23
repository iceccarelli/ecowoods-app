'use client';

import { useMemo, useState } from 'react';
import {
  WORKSPACE_ASSISTANT,
  WORKSPACE_GREETING,
  WORKSPACE_RENOVATION_CHIPS,
  WORKSPACE_COMPOSER_PLACEHOLDER,
} from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { recommendProducts, recommendServices, selectionIncompatibilities } from '@/lib/assistant-workspace/recommendations';
import { projectRangeForState } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import type { AssistantChatCard, AssistantChatResponse } from '@/lib/assistant-workspace/chat-schema';
import type { WorkspacePatch, WorkspaceState } from '@/lib/assistant-workspace/types';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { ProductCard } from './ProductCard';
import { ServiceCard } from './ServiceCard';
import { ConversionPanel } from './ConversionPanel';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
  cards?: AssistantChatCard[];
}

/** Start screen: 3–4 starters only (v8). */
const START_CHIPS = WORKSPACE_RENOVATION_CHIPS.slice(0, 4);

/** Progressive disclosure — few cards when earned, not a catalogue dump. */
const EARNED_PRODUCT_LIMIT = 2;

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

  const products = useMemo(() => recommendProducts(state, EARNED_PRODUCT_LIMIT), [state]);
  const services = useMemo(() => recommendServices(state).slice(0, 2), [state]);
  const incompatibilities = useMemo(() => selectionIncompatibilities(state), [state]);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

  /** Earned: visitor has talked AND we know an objective — then limited catalog cards. */
  const showEarnedCatalog = Boolean(state.objective && messages.length > 0);
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

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          workspace: snapshotFromState(state),
        }),
      });

      if (!res.ok) {
        setMessages((prev) => [...prev, keywordFallback(trimmed)]);
        return;
      }

      const data = (await res.json()) as AssistantChatResponse;
      const nextPatch = coercePatch(data.patch);
      if (Object.keys(nextPatch).length) patch(nextPatch);

      const { patch: keywordPatch } = interpretMessage(trimmed);
      if (Object.keys(keywordPatch).length) patch(keywordPatch);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : keywordFallback(trimmed).text,
          cards: Array.isArray(data.cards) ? data.cards.slice(0, 2) : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, keywordFallback(trimmed)]);
    } finally {
      setBusy(false);
    }
  };

  const onAddProduct = (productId: string) => patch({ targetFloor: { productId } });
  const onAddService = (slug: string) => {
    if (state.selectedServiceSlugs.includes(slug)) return;
    patch({ selectedServiceSlugs: [...state.selectedServiceSlugs, slug] });
  };

  return (
    <section className="aha-conversation aha-conversation--canvas" aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}>
      <div className="aha-conversation-scroll">
        {!messages.length ? (
          <div className="aha-start">
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
              <div key={i} className={`aha-message aha-message--${m.role}`}>
                <p className="aha-message-author">{m.role === 'assistant' ? WORKSPACE_ASSISTANT.name : 'You'}</p>
                <p className="aha-message-text">{m.text}</p>
                {m.cards && m.cards.length > 0 && (
                  <ul className="aha-inline-cards">
                    {m.cards.map((c, j) => (
                      <li key={j} className="aha-inline-card">
                        <p className="aha-inline-card-title">{c.title}</p>
                        <p className="aha-inline-card-body">{c.body}</p>
                        {c.href ? (
                          <a className="aha-inline-card-link" href={c.href} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {busy && (
              <div className="aha-message aha-message--assistant" aria-live="polite">
                <p className="aha-message-author">{WORKSPACE_ASSISTANT.name}</p>
                <p className="aha-message-text">Thinking…</p>
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

            {showEarnedCatalog && (
              <div className="aha-earned">
                {incompatibilities.length > 0 && (
                  <div className="aha-incompatibility" role="alert">
                    {incompatibilities.map((i) => (
                      <p key={i.axis}>{i.reason}</p>
                    ))}
                  </div>
                )}
                {products.length > 0 && (
                  <>
                    <p className="aha-recommended-heading">Worth considering</p>
                    <div className="aha-card-grid aha-card-grid--compact">
                      {products.map((rec) => (
                        <ProductCard key={rec.product.id} recommendation={rec} onAdd={onAddProduct} />
                      ))}
                    </div>
                  </>
                )}
                {services.length > 0 && (
                  <>
                    <p className="aha-recommended-heading">Services</p>
                    <div className="aha-card-grid aha-card-grid--compact">
                      {services.map((rec) => (
                        <ServiceCard key={rec.service.slug} recommendation={rec} onAdd={onAddService} />
                      ))}
                    </div>
                  </>
                )}
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

      <form
        className="aha-composer aha-composer--premium"
        onSubmit={(event) => {
          event.preventDefault();
          void respond(draft);
        }}
        aria-label={`Message ${WORKSPACE_ASSISTANT.name}`}
      >
        <input
          type="text"
          className="aha-composer-input"
          placeholder={WORKSPACE_COMPOSER_PLACEHOLDER}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}
          disabled={busy}
          autoFocus
        />
        <button type="submit" className="aha-composer-send" disabled={!draft.trim() || busy}>
          Send
        </button>
      </form>
    </section>
  );
}
