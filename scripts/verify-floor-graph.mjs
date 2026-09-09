#!/usr/bin/env node
/**
 * verify-floor-graph.mjs — the guard on the only asset that compounds.
 *
 * WHY THIS EXISTS
 *
 * The Floor Graph is the one part of this repository a competitor cannot copy,
 * and it is also the one part where a small, well-meaning edit does damage
 * that is invisible for months. Four failure modes, each of which has a
 * precedent somewhere in this codebase's history:
 *
 *   1. AN IDENTIFIER LANDS IN THE BENCHMARK TABLE. `FrameworkScoring` is
 *      designed to be publishable whole. Someone adds `email` "so we can
 *      follow up" and the dataset can never be released — and nobody notices,
 *      because nothing breaks.
 *
 *   2. A PHOTOGRAPH'S CONSENT LINK BECOMES OPTIONAL. `AssessmentPhoto.
 *      consentId` is NOT NULL on purpose. Made nullable, the system quietly
 *      starts retaining images whose lawful basis cannot be named.
 *
 *   3. CONSENT WORDING IS EDITED IN PLACE. The ledger stores the exact string
 *      shown to the person. Editing the string without moving its version
 *      means every historical row now claims wording that was never displayed,
 *      which is worse than having no ledger at all.
 *
 *   4. A HARD FOREIGN KEY IS ADDED FROM THE FLOOR GRAPH TO THE COMMERCIAL
 *      RECORD. That reintroduces the cascade the schema was shaped to avoid:
 *      erasing a lead would delete the physical record of a floor that still
 *      exists in a house.
 *
 * Dependency-free and connectionless, like the other guards in the pre-build
 * gate. It parses text and finishes in under a second.
 *
 * Run:  pnpm verify:floorgraph
 * CI:   .github/workflows/web.yml (guards job)
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SCHEMA = 'apps/web/prisma/schema.prisma';
const CONSENT = 'apps/web/lib/floor-graph/wording.ts';
const CAPTURE = 'apps/web/lib/floor-graph/index.ts';
const DOCS = 'docs/FLOOR_GRAPH.md';
const BASELINE = 'scripts/floor-graph-baseline.json';

/** The models this guard governs. Adding one here is how you opt it in. */
const FLOOR_GRAPH_MODELS = [
  'ConsentRecord',
  'FloorRecord',
  'FloorAssessment',
  'AssessmentPhoto',
  'FrameworkScoring',
  'JobOutcome',
  'Prediction',
];

/** Column-name fragments that must never appear in the benchmark table. */
const FORBIDDEN_IN_BENCHMARK = [
  'email',
  'name',
  'phone',
  'address',
  'postal',
  'ip',
  'userid',
  'user',
  'note',
  'comment',
  'message',
  'contact',
  'session',
  'fingerprint',
];

/** The commercial models the Floor Graph must not hard-link to. */
const COMMERCIAL_MODELS = ['QuoteRequest', 'Project', 'User', 'Invoice', 'Payment'];

const errors = [];
const notes = [];

function need(path) {
  if (!existsSync(path)) {
    errors.push(`missing file: ${path} — run from the repo root`);
    return null;
  }
  return readFileSync(path, 'utf8');
}

const schema = need(SCHEMA);
const consent = need(CONSENT);
const capture = need(CAPTURE);
const docs = need(DOCS);

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}

// ── extract each model block ────────────────────────────────────────────────
function modelBlock(name) {
  const re = new RegExp(`(^|\\n)model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = schema.match(re);
  return m ? m[2] : null;
}

const blocks = {};
for (const name of FLOOR_GRAPH_MODELS) {
  const b = modelBlock(name);
  if (!b) errors.push(`model ${name} is missing from ${SCHEMA}`);
  else blocks[name] = b;
}

// ── 1. the benchmark table carries nothing identifying ──────────────────────
if (blocks.FrameworkScoring) {
  const fields = blocks.FrameworkScoring
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('///') && !l.startsWith('@@'));
  for (const line of fields) {
    const field = line.split(/\s+/)[0].toLowerCase();
    for (const bad of FORBIDDEN_IN_BENCHMARK) {
      if (field.includes(bad)) {
        errors.push(
          `FrameworkScoring.${line.split(/\s+/)[0]} looks like an identifier (matched "${bad}"). ` +
            'That table is designed to be publishable whole — an identifier in it ends that permanently.',
        );
      }
    }
  }
  if (!/scoredOn\s+DateTime\s+@db\.Date/.test(blocks.FrameworkScoring)) {
    errors.push(
      'FrameworkScoring.scoredOn must stay @db.Date. A precise timestamp on a low-volume table ' +
        're-links an anonymous row to the request log that produced it.',
    );
  }
}

// ── 2. a retained photograph always names its lawful basis ──────────────────
if (blocks.AssessmentPhoto) {
  if (!/\n\s*consentId\s+String\s+@db\.Uuid/.test(blocks.AssessmentPhoto)) {
    errors.push(
      'AssessmentPhoto.consentId must be a required (non-optional) String @db.Uuid. ' +
        'A retained photograph whose consent row cannot be named should not exist.',
    );
  }
}

// ── 3. no hard foreign key from the Floor Graph to the commercial record ────
for (const [name, block] of Object.entries(blocks)) {
  for (const commercial of COMMERCIAL_MODELS) {
    const re = new RegExp(`@relation\\([^)]*references:\\s*\\[id\\][^)]*\\)`);
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.includes('@relation')) continue;
      const type = trimmed.split(/\s+/)[1]?.replace('?', '').replace('[]', '');
      if (type === commercial && re.test(trimmed)) {
        errors.push(
          `${name} declares a Prisma relation to ${commercial}. The Floor Graph links to the ` +
            'commercial record with indexed UUID columns and no relation, so that erasing a lead ' +
            'can never cascade into the physical record of a floor. Join in application code.',
        );
      }
    }
  }
}

// ── 4. consent wording cannot change without its version moving ─────────────
const wordingRe =
  /(\w+):\s*\{\s*purpose:\s*'(\w+)',\s*text:\s*([\s\S]*?),\s*version:\s*'([^']+)',\s*\}/g;
const wordings = {};
let match;
while ((match = wordingRe.exec(consent)) !== null) {
  const [, key, purpose, rawText, version] = match;
  if (key !== purpose) {
    errors.push(`CONSENT_WORDING.${key} declares purpose '${purpose}' — key and purpose must match.`);
  }
  const text = rawText
    .split('\n')
    .map((l) => l.trim())
    .join(' ')
    .replace(/^'|'$/g, '')
    .replace(/'\s*\+?\s*'/g, '');
  wordings[purpose] = { version, sha: createHash('sha256').update(text).digest('hex').slice(0, 16) };
}

if (Object.keys(wordings).length === 0) {
  errors.push(`no CONSENT_WORDING entries parsed from ${CONSENT} — the guard cannot verify wording drift`);
}

if (existsSync(BASELINE)) {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  if (process.argv.includes('--update')) {
    notes.push('--update given: rewrite scripts/floor-graph-baseline.json by hand from the values below');
    for (const [purpose, v] of Object.entries(wordings)) {
      notes.push(`  "${purpose}": { "version": "${v.version}", "sha": "${v.sha}" }`);
    }
  } else {
    for (const [purpose, current] of Object.entries(wordings)) {
      const known = baseline.wording?.[purpose];
      if (!known) {
        errors.push(
          `CONSENT_WORDING.${purpose} is not in ${BASELINE}. Add it with its version and sha ` +
            'so future edits are visible.',
        );
        continue;
      }
      if (current.sha !== known.sha && current.version === known.version) {
        errors.push(
          `CONSENT_WORDING.${purpose} text changed but version is still '${current.version}'. ` +
            'The ledger stores the exact string shown to the person — bump the version and update ' +
            `${BASELINE}, or every historical row now claims wording nobody was ever shown.`,
        );
      }
    }
  }
} else {
  errors.push(`missing ${BASELINE} — the consent wording baseline is what makes drift visible`);
}

// ── 5. the capture layer refuses a photograph without a consent id ──────────
if (capture && !/storeAssessmentPhotos\(\s*[\s\S]*?consentId:\s*string/.test(capture)) {
  errors.push(
    'lib/floor-graph/index.ts: storeAssessmentPhotos must take an explicit `consentId: string`. ' +
      'A boolean parameter is how "we had consent" becomes unprovable.',
  );
}

// ── 6. every model is documented ────────────────────────────────────────────
for (const name of FLOOR_GRAPH_MODELS) {
  if (docs && !docs.includes(name)) {
    errors.push(`${DOCS} does not mention model ${name}. An undocumented column is an unowned column.`);
  }
}

// ── report ──────────────────────────────────────────────────────────────────
for (const n of notes) console.log(n);
if (errors.length) {
  console.error('');
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n✗ floor graph: ${errors.length} problem(s)`);
  process.exit(1);
}

console.log(
  `✓ floor graph verified — ${FLOOR_GRAPH_MODELS.length} model(s), ` +
    `${Object.keys(wordings).length} consent wording(s) at baseline, no identifiers in the benchmark table`,
);
