'use client';

import { useState } from 'react';
import { WORKSPACE_ASSISTANT, WORKSPACE_GREETING, WORKSPACE_CHIPS } from '@/lib/assistant-workspace/identity';
import { interpretMessage } from '@/lib/assistant-workspace/interpret';
import { useWorkspaceState } from './WorkspaceStateProvider';

interface DisplayMessage {
  role: 'assistant' | 'user';
  text: string;
}

/**
 * ConversationPane — the center zone of the workspace shell.
 *
 * ASSISTANT-02: the composer is live, but there is still no model call. Free
 * text goes through interpretMessage() — a deterministic, catalog-backed
 * keyword matcher (lib/assistant-workspace/interpret.ts) — and only what it
 * actually recognizes is written into Project Decision State. Nothing here
 * invents a product, a price, or a next step; a message that matches
 * nothing gets an honest "didn't catch anything" reply, not a guess.
 *
 * This intentionally does not stream against /api/chat: that route and its
 * tools belong to the corner Quick Assistant and stay untouched. A real
 * model call for this workspace is a later phase, per
 * docs/assistant-workspace/NEW_ASSISTANT_ARCHITECTURE.md, and it will return
 * structured cards, not a re-parsed transcript like this one.
 *
 * The conversation transcript itself is local UI state, not part of Project
 * Decision State — the architecture doc is explicit that state is the
 * central object and conversation is one interface onto it, not the record.
 */
export function ConversationPane() {
  const { state, patch } = useWorkspaceState();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);

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

        {!state.objective && !messages.length && (
          <div className="aha-coming-online">
            <p className="aha-coming-online-title">How this works right now</p>
            <p className="aha-coming-online-text">
              Tell us the species, finish, pattern or service you have in mind and it lands on the right, under
              this project. A full conversation with product and cost cards is coming in a later phase — this one
              recognizes what you name against our real catalogue, and nothing else.
            </p>
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
