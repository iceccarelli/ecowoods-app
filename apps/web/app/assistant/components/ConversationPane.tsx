'use client';

import { useMemo, useState } from 'react';
import { WORKSPACE_ASSISTANT, WORKSPACE_GREETING, WORKSPACE_CHIPS } from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { recommendProducts, recommendServices, selectionIncompatibilities } from '@/lib/assistant-workspace/recommendations';
import { totalSquareFeet } from '@/lib/assistant-workspace/state';
import { useWorkspaceState } from './WorkspaceStateProvider';
import { ProductCard } from './ProductCard';
import { ServiceCard } from './ServiceCard';
import { ScenarioCompare } from './ScenarioCompare';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
}

const RECOMMENDED_PRODUCT_LIMIT = 4;

/**
 * ConversationPane — the center zone of the workspace shell.
 *
 * ASSISTANT-02 gave the composer a deterministic keyword matcher
 * (interpretMessage) with no model call. ASSISTANT-03 added real
 * ProductCard/ServiceCard recommendations once state carries an objective.
 * ASSISTANT-04 adds a thin, real ScenarioCompare once square footage is
 * known — two published bands, priced at the visitor's own area, via
 * lib/assistant-workspace/economics.ts. "Add to project" on a card patches
 * the SAME store every other zone reads; ScenarioCompare is read-only
 * (comparing scopes, not choosing one).
 *
 * Still no model call, still not /api/chat — that route and its tools
 * belong to the corner Quick Assistant and stay untouched.
 */
export function ConversationPane() {
  const { state, patch } = useWorkspaceState();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

  const products = useMemo(() => recommendProducts(state, RECOMMENDED_PRODUCT_LIMIT), [state]);
  const services = useMemo(() => recommendServices(state), [state]);
  const incompatibilities = useMemo(() => selectionIncompatibilities(state), [state]);
  const sqft = totalSquareFeet(state);

  const respond = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { patch: next, understood } = interpretMessage(trimmed);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      {
        role: 'assistant',
        text: understood.length
          ? `Got it — added to this project: ${understood.join('; ')}.`
          : "I didn't catch anything I can add to this project yet. Try naming a species, a finish, a pattern, a service, or square footage, and I'll fill it in on the right.",
      },
    ]);
    if (Object.keys(next).length) patch(next);
    setDraft('');
  };

  const onChip = (chip: string) => respond(chip);

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
          </div>
        ))}

        {!messages.length && (
          <div className="aha-chips" role="group" aria-label="Starter prompts">
            {WORKSPACE_CHIPS.map((chip) => (
              <button key={chip} type="button" className="aha-chip" onClick={() => onChip(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        {!showRecommendations && (
          <div className="aha-coming-online">
            <p className="aha-coming-online-title">How this works right now</p>
            <p className="aha-coming-online-text">
              Tell us the species, finish, pattern or service you have in mind and it lands on the right, under
              this project. Once you say what you're here to do, real products and services from our catalogue
              show up below, matched to what you've told us.
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
          </div>
        )}
      </div>

      <form
        className="aha-composer"
        onSubmit={(event) => {
          event.preventDefault();
          respond(draft);
        }}
        aria-label="Message the AI Home Advisor"
      >
        <input
          type="text"
          className="aha-composer-input"
          placeholder="Tell us about your floor — species, finish, sq ft…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="aha-composer-send" disabled={!draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
