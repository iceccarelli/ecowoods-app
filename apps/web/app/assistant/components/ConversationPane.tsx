'use client';

import { useMemo, useState } from 'react';
import { WORKSPACE_ASSISTANT, WORKSPACE_GREETING, WORKSPACE_CHIPS, WORKSPACE_COMPOSER_PLACEHOLDER } from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { recommendProducts, recommendServices, selectionIncompatibilities } from '@/lib/assistant-workspace/recommendations';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { projectRangeForState } from '@/lib/assistant-workspace/economics';
import { buildValueScenario, type CaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario';
import type { AssistantChatCard, AssistantChatResponse } from '@/lib/assistant-workspace/chat-schema';
import type { WorkspacePatch, WorkspaceState } from '@/lib/assistant-workspace/types';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { ProductCard } from './ProductCard';
import { ServiceCard } from './ServiceCard';
import { ScenarioCompare } from './ScenarioCompare';
import { ValueScenarioCard } from './ValueScenarioCard';
import { ConversionPanel } from './ConversionPanel';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
  cards?: AssistantChatCard[];
}

const RECOMMENDED_PRODUCT_LIMIT = 4;

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
 * ConversationPane — center zone of the Ask Francisco workspace.
 *
 * PR-2 wires the composer to POST /api/assistant/chat (workspace-owned
 * structured model path). Corner /api/chat + ChatWidget stay untouched.
 * On 503 / network failure, falls back to interpretMessage so the rails
 * still update from keywords. Conversion writes stay in ConversionPanel.
 */
export function ConversationPane({ evidencePool }: { evidencePool: CaseStudyEvidence[] }) {
  const { state, patch } = useWorkspaceState();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const products = useMemo(() => recommendProducts(state, RECOMMENDED_PRODUCT_LIMIT), [state]);
  const services = useMemo(() => recommendServices(state), [state]);
  const incompatibilities = useMemo(() => selectionIncompatibilities(state), [state]);
  const sqft = totalSquareFeet(state);
  const projectRange = useMemo(() => projectRangeForState(state), [state]);
  const valueScenario = useMemo(
    () => buildValueScenario(state, projectRange, evidencePool),
    [state, projectRange, evidencePool],
  );

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
    }
  };

  const onChip = (chip: string) => {
    void respond(chip);
  };

  const onAddProduct = (productId: string) => patch({ targetFloor: { productId } });

  const onAddService = (slug: string) => {
    if (state.selectedServiceSlugs.includes(slug)) return;
    patch({ selectedServiceSlugs: [...state.selectedServiceSlugs, slug] });
  };

  const showRecommendations = Boolean(state.objective);

  return (
    <section className="aha-conversation" aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}>
      <div className="aha-conversation-scroll">
        <div className="aha-message aha-message--assistant">
          <p className="aha-message-author">{WORKSPACE_ASSISTANT.name}</p>
          <p className="aha-message-text">{WORKSPACE_GREETING}</p>
        </div>

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

        {!messages.length && (
          <div className="aha-chips" role="group" aria-label="Starter prompts">
            {WORKSPACE_CHIPS.map((chip) => (
              <button key={chip} type="button" className="aha-chip" onClick={() => onChip(chip)} disabled={busy}>
                {chip}
              </button>
            ))}
          </div>
        )}

        {!showRecommendations && (
          <div className="aha-coming-online">
            <p className="aha-coming-online-title">How this works right now</p>
            <p className="aha-coming-online-text">
              Tell me the neighbourhood and what you want done on this house — kitchen, roof, floors, or the
              sequence. When hardwood is in scope, products and services from our catalogue land on the right
              under this project. For other trades I still give a sourced market range when the adapter is live;
              until then I say pending / not available rather than invent dollars. Ecowoods only bids the floors
              and stairs we install — confirm a measure or quote in Next step below when you are ready.
            </p>
          </div>
        )}

        {showRecommendations && (
          <div className="aha-recommended">
            <p className="aha-recommended-heading">Recommended for your project</p>

            {incompatibilities.length > 0 && (
              <div className="aha-incompatibility" role="alert">
                {incompatibilities.map((i) => (
                  <p key={i.axis}>{i.reason}</p>
                ))}
              </div>
            )}

            <div className="aha-card-grid">
              {products.map((rec) => (
                <ProductCard key={rec.product.id} recommendation={rec} onAdd={onAddProduct} />
              ))}
            </div>

            <p className="aha-recommended-heading">Services</p>
            <div className="aha-card-grid">
              {services.map((rec) => (
                <ServiceCard key={rec.service.slug} recommendation={rec} onAdd={onAddService} />
              ))}
            </div>

            {sqft !== undefined && <ScenarioCompare squareFeet={sqft} country={state.country} />}

            <p className="aha-recommended-heading">Value scenario</p>
            {valueScenario.status === 'ready' ? (
              <ValueScenarioCard scenario={valueScenario.scenario} />
            ) : (
              <p className="aha-card-why-empty">
                {valueScenario.status === 'needs-sqft'
                  ? 'Add a square footage above to see a value scenario for this project.'
                  : 'Add a service above to see a value scenario for this project.'}
              </p>
            )}

            <p className="aha-recommended-heading" id="aha-next-step">Next step</p>
            <ConversionPanel projectRange={projectRange} />
          </div>
        )}
      </div>

      <form
        className="aha-composer"
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
        />
        <button type="submit" className="aha-composer-send" disabled={!draft.trim() || busy}>
          Send
        </button>
      </form>
    </section>
  );
}
