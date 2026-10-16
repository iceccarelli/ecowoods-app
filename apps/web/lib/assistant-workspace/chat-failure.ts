import { BUSINESS_NAP } from '@ecowoods/shared/constants';

export interface ChatFailure {
  text: string;
  /** Whether sending the same message again could succeed — drives the retry button. */
  retryable: boolean;
}

/**
 * What the visitor is told when /api/assistant/chat answers with an error
 * status. Each status the route can return says what actually happened and
 * what to do next; none of them claims a charge was made, and the ones where a
 * retry cannot help do not offer one.
 */
export function chatFailure(status: number, retryAfterHeader?: string | null): ChatFailure {
  const call = `call ${BUSINESS_NAP.phoneDisplay}`;
  if (status === 429) {
    const secs = Number(retryAfterHeader);
    const wait = Number.isFinite(secs) && secs > 0 ? `about ${Math.ceil(secs)} seconds` : 'a moment';
    return { text: `That was a lot of messages at once. Try again in ${wait}. Nothing was charged.`, retryable: true };
  }
  if (status === 413) {
    return { text: 'That message is too long for me to read in one go. Shorten it or split it in two. Nothing was charged.', retryable: false };
  }
  if (status === 503) {
    return { text: `The live advisor is not available right now. You can still use the estimate form, or ${call}. Nothing was charged.`, retryable: false };
  }
  return { text: `I couldn't complete that analysis. Nothing was charged. Try again, or ${call}.`, retryable: true };
}
