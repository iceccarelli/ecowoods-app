/**
 * The phrases that mark internal-process language. Shared by
 * scripts/verify-public-wording.mjs (source scan) and
 * apps/web/tests/drift.test.ts (rendered llms*.txt, ai.txt, markdown twins and
 * /api/v1), so both fail on the same list.
 */
export const BANNED = [
  [/\bF-\d{2,3}\b/, 'audit finding reference'],
  [/\bunproven\b/i, '"unproven"'],
  [/\bwe cannot claim\b/i, '"we cannot claim"'],
  [/\bnot finished\b/i, '"not finished"'],
  [/\bpending[ -]verification\b/i, '"pending verification"'],
  [/\bpending_key\b/, 'engineering status "pending_key"'],
  [/\bNONE RECORDED\b/, '"NONE RECORDED"'],
  [/\bNamed but not published\b/i, '"named but not published"'],
  [/\bfenced (out|to)\b/i, 'engineering term "fenced"'],
  [/\b(TODO|TBD|WIP|FIXME)\b/, 'to-do marker'],
  [/\bplaceholder\b(?!\s*[=:'"])/i, '"placeholder"'],
  [/\bsee audit\//i, 'audit-file reference'],
];
