/**
 * lib/site-search.ts — what /search can find.
 *
 * The navigation carries the services, tools and sections; the glossary,
 * guides and papers carry the answers people actually type ("cupping",
 * "nail-down or glue-down"). Searching the menus alone found none of them.
 * Every entry here is read from the registry that owns it, so a term added to
 * the glossary is searchable the same commit and a page that no longer exists
 * cannot be returned.
 *
 * The assistant's find_on_site tool deliberately stays on navigation only
 * (lib/assistant-site.ts): it hands out one URL per reply and must never name a
 * page the menus do not carry.
 */
import { DESTINATIONS } from '@/lib/navigation';
import { GLOSSARY } from '@/lib/glossary';
import { GUIDES } from '@/lib/guides';
import { PAPERS } from '@/lib/papers';

export interface SearchEntry {
  href: string;
  label: string;
  note?: string;
  group: string;
  /** Strong terms (title, aliases, topics) and weaker prose. */
  strong: string;
  weak: string;
}

let INDEX: SearchEntry[] | null = null;

function build(): SearchEntry[] {
  const out: SearchEntry[] = [];
  const seen = new Set<string>();
  const add = (e: SearchEntry) => {
    if (seen.has(e.href)) return;
    seen.add(e.href);
    out.push(e);
  };
  for (const d of DESTINATIONS) {
    add({ href: d.href, label: d.label, note: d.note, group: d.group, strong: d.label, weak: d.note ?? '' });
  }
  for (const t of GLOSSARY) {
    add({ href: `/glossary/${t.slug}`, label: t.term, note: t.short, group: 'Glossary', strong: [t.term, ...(t.aka ?? [])].join(' '), weak: t.short });
  }
  for (const g of GUIDES) {
    add({ href: `/guides/${g.slug}`, label: g.seoTitle ?? g.title, note: g.summary, group: 'Guides', strong: `${g.title} ${g.seoTitle ?? ''}`, weak: `${g.question} ${g.summary}` });
  }
  for (const p of PAPERS) {
    add({ href: `/papers/${p.slug}`, label: p.title, note: p.abstract, group: 'Technical papers', strong: `${p.title} ${p.topics.join(' ')}`, weak: `${p.subtitle} ${p.abstract}` });
  }
  return out;
}

export function searchSite(query: string, limit = 20): SearchEntry[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!terms.length) return [];
  INDEX ??= build();
  return INDEX.map((e) => {
    const strong = e.strong.toLowerCase();
    const weak = e.weak.toLowerCase();
    const path = e.href.toLowerCase().replace(/[/#-]+/g, ' ');
    let score = 0;
    let matched = 0;
    for (const t of terms) {
      let s = 0;
      if (strong.includes(t)) s += 3;
      if (weak.includes(t)) s += 2;
      if (path.includes(t)) s += 1;
      if (s) matched += 1;
      score += s;
    }
    /* Every typed word must hit something, or "hardwood zebra" would return all
       of hardwood. */
    return { e, score: matched === terms.length ? score : 0 };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
