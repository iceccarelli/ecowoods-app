/**
 * What the visitor is told when POST /api/assistant/attachments fails.
 *
 * 403 is the new-device case: the design id is in this browser's
 * localStorage but the private conversation cookie is not (cleared cookies,
 * another device, an incognito window). Retrying can never succeed, so the
 * message says so and offers a fresh conversation rather than a retry.
 */
export interface AttachmentUploadFailure {
  text: string;
  /** Whether to offer starting a new conversation (the only way past a 403). */
  offerNewConversation: boolean;
}

export function attachmentUploadFailure(status: number, serverMessage?: string, retryAfterHeader?: string | null): AttachmentUploadFailure {
  if (status === 403) {
    return {
      text: "Photos can't be added to this saved conversation from this browser — it was started on another browser or device.",
      offerNewConversation: true,
    };
  }
  if (status === 429) {
    const secs = Number(retryAfterHeader);
    const wait = Number.isFinite(secs) && secs > 0 ? `about ${Math.ceil(secs)} seconds` : 'a moment';
    return { text: `That was a lot of uploads at once. Try again in ${wait}.`, offerNewConversation: false };
  }
  if (status === 400 && serverMessage) return { text: serverMessage, offerNewConversation: false };
  return { text: "Couldn't upload that photo. Remove it and try again, or send your message without it.", offerNewConversation: false };
}
