'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { WORKSPACE_ASSISTANT, WORKSPACE_GREETING, WORKSPACE_CHIPS, WORKSPACE_COMPOSER_PLACEHOLDER } from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { recommendProducts, recommendServices } from '@/lib/assistant-workspace/recommendations';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState, formatMoneyRange } from '@/lib/assistant-workspace/economics';
import type { AssistantChatCard, AssistantChatResponse } from '@/lib/assistant-workspace/chat-schema';
import type { WorkspacePatch, WorkspaceState } from '@/lib/assistant-workspace/types';
import { useWorkspaceState } from './WorkspaceStateProvider';
import type { PanelKind } from './WorkspaceShell';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
  cards?: AssistantChatCard[];
}

const STARTER_CHIPS = WORKSPACE_CHIPS.slice(0, 4);

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

/** Coerce API patch JSON into a WorkspacePatch — drop unknown shapes. */
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
 * ConversationPane — the whole workspace surface between `AssistantHeader`
 * and the composer.
 *
 * Chat is primary: the assistant's natural-language reply is the thing
 * every turn renders. What used to sit permanently below every reply — the
 * full ProductCard/ServiceCard grid, ScenarioCompare, ValueScenarioCard and
 * ConversionPanel, all four every time an objective was set — is now ONE
 * compact contextual card with up to three action buttons that open the
 * shared `ContextDrawer` (via `onOpenPanel`, owned by `WorkspaceShell`) for
 * the full detail: "See recommendations," "Compare alternatives," "Get
 * estimate." No dashboard crammed into the transcript.
 *
 * POSTs to /api/assistant/chat (workspace-owned structured model path,
 * untouched by this redesign). On 503 / network failure, falls back to
 * interpretMessage so the compact card still updates from keywords.
 */
export function ConversationPane({
  onOpenPanel,
}: {
  onOpenPanel: (panel: Exclude<PanelKind, null>) => void;
}) {
  const { state, patch } = useWorkspaceState();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const products = useMemo(() => recommendProducts(state, 4), [state]);
  const services = useMemo(() => recommendServices(state), [state]);
  const sqft = totalSquareFeet(state);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);

  const keywordFallback = (trimmed: string): DisplayMessage => {
    const { patch: next, understood } = interpretMessage(trimmed);
    if (Object.keys(next).length) patch(next);
    return {
      role: 'assistant',
      text: understood.length
        ? `Got it — added to this project: ${understood.join('; ')}. (Model path unavailable — using the keyword matcher for now.)`
        : "I didn't catch anything I can add to this project yet, and the live advisor is temporarily unavailable. Try naming a species, finish, service, or square footage — or ask again in a moment.",
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

      if (res.status === 503 || res.status === 429) {
        setMessages((prev) => [...prev, keywordFallback(trimmed)]);
        return;
      }

      if (!res.ok) {
        setMessages((prev) => [...prev, keywordFallback(trimmed)]);
        return;
      }

      const data = (await res.json()) as AssistantChatResponse;
      const nextPatch = coercePatch(data.patch);
      if (Object.keys(nextPatch).length) patch(nextPatch);

      // Also run keyword interpret so a model that forgot attach_to_project
      // still lands obvious catalog hits — applyPatch sanitizes duplicates.
      const { patch: keywordPatch } = interpretMessage(trimmed);
      if (Object.keys(keywordPatch).length) patch(keywordPatch);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : keywordFallback(trimmed).text,
          cards: Array.isArray(data.cards) ? data.cards.slice(0, 4) : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, keywordFallback(trimmed)]);
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  };

  const onChip = (chip: string) => {
    void respond(chip);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void respond(draft);
    }
  };

  const showContextCard = Boolean(state.objective);
  const started = messages.length > 0;

  return (
    <section className="aha-conversation" aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}>
      <div className="aha-conversation-scroll" data-empty={!started}>
        {!started && (
          <div className="aha-empty-state">
            <p className="aha-empty-title">{WORKSPACE_ASSISTANT.name}</p>
            <p className="aha-empty-lede">{WORKSPACE_GREETING}</p>
          </div>
        )}

        {started && (
          <div className="aha-message aha-message--assistant">
            <p className="aha-message-author">{WORKSPACE_ASSISTANT.name}</p>
            <p className="aha-message-text">{WORKSPACE_GREETING}</p>
          </div>
        )}

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

        {showContextCard && (
          <div className="aha-context-card">
            <p className="aha-context-card-title">This project</p>
            <p className="aha-context-card-body">
              {products.length ? `${products.length} floor option${products.length === 1 ? '' : 's'}` : 'A floor option'}
              {services.length ? ` and ${services.length} service${services.length === 1 ? '' : 's'}` : ''} match what you told me
              {sqft !== undefined ? ` at ${sqft.toLocaleString()} sq ft` : ''}
              {projectRange.status === 'ready' ? ` — estimated ${formatMoneyRange(projectRange.total)}.` : '.'}
            </p>
            <div className="aha-context-card-actions">
              <button type="button" className="aha-card-action aha-card-action--primary" onClick={() => onOpenPanel('recommendations')}>
                See recommendations
              </button>
              {sqft !== undefined && (
                <button type="button" className="aha-card-action" onClick={() => onOpenPanel('compare')}>
                  Compare alternatives
                </button>
              )}
              {projectRange.status === 'ready' && (
                <button type="button" className="aha-card-action" onClick={() => onOpenPanel('conversion')}>
                  Book / get estimate
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!started && (
        <div className="aha-chips aha-chips--start" role="group" aria-label="Starter prompts">
          {STARTER_CHIPS.map((chip) => (
            <button key={chip} type="button" className="aha-chip" onClick={() => onChip(chip)} disabled={busy}>
              {chip}
            </button>
          ))}
        </div>
      )}

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
          placeholder={WORKSPACE_COMPOSER_PLACEHOLDER}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
          aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}
          disabled={busy}
          rows={1}
        />
        <button type="submit" className="aha-composer-send" disabled={!draft.trim() || busy} aria-label={busy ? 'Sending' : 'Send'}>
          {busy ? '…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
