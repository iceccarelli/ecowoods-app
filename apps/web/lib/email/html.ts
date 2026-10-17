/**
 * HTML-safe building blocks for email bodies. Every value a customer typed
 * (name, address, free-text note, filename) is untrusted: interpolated raw into
 * the desk's inbox it can inject links or markup that look like Ecowoods' own
 * message, and into a customer's inbox it can do the same to a third party.
 */
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** The two-column key/value table the desk-notification emails share. Escapes both cells. */
export function detailRowsHtml(rows: ReadonlyArray<readonly [string, string]>): string {
  return rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b5d4f;">${escapeHtml(k)}</td><td style="padding:4px 0;"><strong>${escapeHtml(v)}</strong></td></tr>`)
    .join('');
}

/** Free text with line breaks kept: escape first, then turn newlines into <br>. */
export function nl2br(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}
