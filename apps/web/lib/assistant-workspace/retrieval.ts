/**
 * lib/assistant-workspace/retrieval.ts — Ask Francisco's deterministic
 * retrieval layer (Gate 1 Phase B).
 *
 * WHAT THIS IS NOT
 *
 * Not a second knowledge base. Every function here reads an existing
 * canonical, in-repo source — GUIDES (lib/guides.ts), PAPERS (lib/papers.ts),
 * PILLARS (lib/framework.ts), and the case-study evidence pool
 * (lib/assistant-workspace/value-scenario-evidence.ts, which is itself the
 * one adapter over the same getCaseStudy() loader /case-studies, the
 * registry and llms.txt already use). There is no HTTP round-trip to this
 * site's own /api/knowledge from here — the source modules are already
 * in-process, so calling our own API over the network would just be a
 * slower, riskier way to read the same array.
 *
 * Not a vector database. Every one of these corpora is small (tens of
 * entries, not thousands) and already carries the field a keyword match
 * needs — a guide's `question`, a paper's `topics`, a pillar's `intent`, a
 * case study's `title`/`neighbourhood`. A term-overlap score over those
 * fields is deterministic, debuggable, and — for a corpus this size —
 * exactly as good at finding "the guide about refinishing" as an embedding
 * would be. Embeddings become worth their operational cost only once a
 * benchmark shows this approach missing real matches; nothing here suggests
 * that yet.
 *
 * PROVENANCE, ALWAYS
 *
 * Every `RetrievalResult` carries its own canonical path and evidence
 * class. The chat route's `retrieve_evidence` tool turns each result into
 * an `evidence` card with that same path as `href` — a citation the model
 * cannot detach from its source, because the source IS the object the
 * model is given back.
 */
import { GUIDES, type Guide } from '@/lib/guides';
import { PAPERS, type Paper } from '@/lib/papers';
import { PILLARS, type FrameworkPillar } from '@/lib/framework';
import type { CaseStudyEvidence } from './value-scenario';

export type RetrievalEntityType = 'guide' | 'paper' | 'framework' | 'case_study';
export type RetrievalEvidenceClass = 'canonical_ecowoods' | 'guide' | 'paper' | 'framework' | 'case_study';

export interface RetrievalResult {
  entityId: string;
  entityType: RetrievalEntityType;
  title: string;
  /** Site-relative path — never an invented URL. */
  canonicalPath: string;
  topic: string;
  geography?: string;
  evidenceClass: RetrievalEvidenceClass;
  /** ISO date where the source publishes one (papers only today). */
  freshness?: string;
  summary: string;
}

/**
 * Term-overlap score, not full-text search: every haystack field here is
 * short and editorial, so "does this WORD appear" is the whole signal worth
 * computing. Word-boundary matching, not substring — a plain `.includes()`
 * matched the query term "not" inside "cannot" and returned an unrelated
 * guide for a topic that shares no real word with it (caught by this
 * module's own test suite before it ever reached a homeowner).
 */
function score(haystacks: string[], topic: string): number {
  const terms = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!terms.length) return 0;
  let total = 0;
  for (const raw of haystacks) {
    const h = raw.toLowerCase();
    for (const t of terms) {
      if (new RegExp(`\\b${t}\\b`).test(h)) total += 1;
    }
  }
  return total;
}

function topN<T>(items: T[], scored: (item: T) => number, limit: number): T[] {
  return items
    .map((item) => ({ item, s: scored(item) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

export function retrieveGuides(topic: string, limit = 2): RetrievalResult[] {
  const hits = topN<Guide>(GUIDES, (g) => score([g.title, g.question, g.seoTitle ?? ''], topic), limit);
  return hits.map((g) => ({
    entityId: g.slug,
    entityType: 'guide',
    title: g.title,
    canonicalPath: `/guides/${g.slug}`,
    topic,
    evidenceClass: 'guide',
    summary: g.question,
  }));
}

export function retrievePapers(topic: string, limit = 1): RetrievalResult[] {
  const hits = topN<Paper>(PAPERS, (p) => score([p.title, p.subtitle, ...p.topics], topic), limit);
  return hits.map((p) => ({
    entityId: p.slug,
    entityType: 'paper',
    title: p.title,
    canonicalPath: `/papers/${p.slug}`,
    topic,
    evidenceClass: 'paper',
    freshness: p.publishedAt,
    summary: p.abstract,
  }));
}

export function retrieveFramework(topic: string, limit = 1): RetrievalResult[] {
  const hits = topN<FrameworkPillar>(PILLARS, (p) => score([p.name, p.intent], topic), limit);
  return hits.map((p) => ({
    entityId: p.id,
    entityType: 'framework',
    title: `Well-Installed Framework — ${p.name}`,
    canonicalPath: '/framework',
    topic,
    evidenceClass: 'framework',
    summary: p.intent,
  }));
}

export function retrieveCaseStudies(
  topic: string,
  pool: readonly CaseStudyEvidence[],
  limit = 1,
): RetrievalResult[] {
  const hits = topN<CaseStudyEvidence>(
    [...pool],
    (c) => score([c.title, c.neighbourhood], topic),
    limit,
  );
  return hits.map((c) => ({
    entityId: c.slug,
    entityType: 'case_study',
    title: c.title,
    canonicalPath: c.url,
    topic,
    geography: c.neighbourhood || undefined,
    evidenceClass: 'case_study',
    summary:
      `${c.squareFootage.toLocaleString('en-CA')} sq ft` +
      `${c.documentsNewFloorInstall ? ', new install' : ', refinish'}` +
      `${c.hasAttributedTestimonial ? ', published testimonial' : ''}.`,
  }));
}

/**
 * The one entry point chat-tools.ts calls. Deliberately capped at 4 total —
 * this feeds a card stack a homeowner reads in one turn, not a bibliography.
 * Guides first (they directly answer a decision question), then one paper
 * (technical depth), one framework pillar (quality standard), one case
 * study (real, but the weakest evidence class of the four — see
 * value-scenario.ts's own discipline against calling one case a universal
 * result).
 */
export function retrieveEvidence(topic: string, casePool: readonly CaseStudyEvidence[]): RetrievalResult[] {
  return [
    ...retrieveGuides(topic, 2),
    ...retrievePapers(topic, 1),
    ...retrieveFramework(topic, 1),
    ...retrieveCaseStudies(topic, casePool, 1),
  ].slice(0, 4);
}
