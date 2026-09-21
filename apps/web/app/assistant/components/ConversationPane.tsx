'use client';

import { useState } from 'react';
import { WORKSPACE_ASSISTANT, WORKSPACE_GREETING, WORKSPACE_CHIPS } from '@/lib/assistant-workspace/identity';

/**
 * ConversationPane — the center zone of the workspace shell.
 *
 * ASSISTANT-01: chrome only. The composer is disabled — no live model call
 * exists yet (that's a later phase, and it will return structured cards, not
 * plain text, once it exists). This intentionally does not stream against
 * /api/chat: that route belongs to the corner Quick Assistant and stays
 * untouched. See docs/assistant-workspace/NO_DUPLICATION_GUARANTEE.md.
 */
export function ConversationPane() {
  const [draft, setDraft] = useState('');

  return (
    <section className="aha-conversation" aria-label={WORKSPACE_ASSISTANT.ariaWorkspace}>
      <div className="aha-conversation-scroll">
        <div className="aha-message aha-message--assistant">
          <p className="aha-message-author">{WORKSPACE_ASSISTANT.name}</p>
          <p className="aha-message-text">{WORKSPACE_GREETING}</p>
        </div>

        <div className="aha-chips" role="group" aria-label="Starter prompts">
          {WORKSPACE_CHIPS.map((chip) => (
            <button key={chip} type="button" className="aha-chip" disabled>
              {chip}
            </button>
          ))}
        </div>

        <div className="aha-coming-online">
          <p className="aha-coming-online-title">Coming online</p>
          <p className="aha-coming-online-text">
            The conversation itself — and the products, cost range and next step it builds — lands in
            the next phase of this workspace. This screen is the shell it will run in.
          </p>
        </div>
      </div>

      <form
        className="aha-composer"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Message the AI Home Advisor"
      >
        <input
          type="text"
          className="aha-composer-input"
          placeholder="Coming online — tell us about your floor soon"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled
          aria-disabled="true"
        />
        <button type="submit" className="aha-composer-send" disabled aria-disabled="true">
          Send
        </button>
      </form>
    </section>
  );
}
