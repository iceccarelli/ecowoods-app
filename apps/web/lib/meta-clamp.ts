/**
 * Keep <title> and <meta name="description"> inside what a search result shows.
 *
 * Long values are not an error, they are truncated mid-word by the engine. These
 * helpers cut at a natural boundary instead — a sentence for descriptions, a
 * separator for titles — and only ever remove text, never add any.
 */
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

export function clampDescription(text: string, max = 160): string {
  const t = collapse(text);
  if (t.length <= max) return t;
  // Prefer the longest run of whole sentences that fits.
  const sentences = t.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim().length >= 60) return out.trim();
  // Otherwise cut at the last word boundary and mark the cut.
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}…`;
}

export function clampTitle(text: string, max = 60): string {
  const t = collapse(text);
  if (t.length <= max) return t;
  // Drop trailing clauses at a separator while the head is still meaningful.
  const parts = t.split(/\s[—–:|]\s|:\s/);
  let out = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    const sep = t.slice(out.length).match(/^\s?[—–:|]\s?|^:\s/)?.[0] ?? ' — ';
    if ((out + sep + parts[i]).length > max) break;
    out += sep + parts[i];
  }
  if (out.length >= 25 && out.length <= max) return out;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}…`;
}
