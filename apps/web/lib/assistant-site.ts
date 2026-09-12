/**
 * lib/assistant-site.ts — what EcowoodsGuide is allowed to know this site has.
 *
 * THE DEFECT THIS EXISTS TO CLOSE
 *
 * The assistant's system prompt is 6,230 characters of careful instruction
 * about voice, price honesty, prompt injection and closing on a next step. It
 * mentions the company's six services by name and insists — correctly — that
 * every reply end on something Ecowoods actually does.
 *
 * And it names ZERO pages. Measured against the shipped prompt:
 *
 *   Floor Studio 0 · camera 0 · /design 0 · /pricing 0 · /quote-check 0 ·
 *   framework 0 · service-areas 0 · corridors 0 · papers 0 · glossary 0 ·
 *   samples 0 · photo triage 0
 *
 * Its five tools are get_company_context, estimate_project, get_availability,
 * book_measure and create_quote_request — every one of them transactional, and
 * not one able to hand a visitor a page. So a homeowner who asks "can I see
 * what walnut would look like in my living room" is told about the six services
 * and offered a measure, by a company whose site will render walnut into a
 * photograph of their living room, live, from their phone camera, for free.
 *
 * That is the single largest gap between what this site can do and what its
 * front door knows about.
 *
 * WHY THIS FILE IS IN apps/web AND NOT IN THE PROMPT
 *
 * packages/shared is upstream of apps/web — that direction is deliberate and
 * GEO-005 records why. The prompt cannot import a route table. So the app
 * appends what it knows at request time, and what it knows is DERIVED from
 * lib/navigation.ts: the same module the desktop panels, the mobile drawer and
 * ⌘K read.
 *
 * The consequence is the point. A page added to a menu is in the assistant's
 * head the same commit, in the same words, with the same note — and the
 * assistant cannot recommend a page the navigation does not carry, or describe
 * one differently from the panel that links it. One truth, one more surface.
 */
import { DESTINATIONS, type Destination } from '@/lib/navigation';

/**
 * The handful of things worth putting IN FRONT of someone rather than waiting
 * to be asked. Everything else is reachable through find_on_site.
 *
 * Each entry is an href plus the trigger — what a homeowner has to say for this
 * to be the right answer. The label and the description are NOT written here;
 * they are pulled from the navigation so they cannot drift from what the menus
 * say about the same page.
 */
const HEADLINE: { href: string; when: string }[] = [
  {
    href: '/floor-studio#live',
    when: 'they wonder what a floor would look like, are choosing between species or patterns, say they cannot picture it, or are on a phone',
  },
  {
    href: '/floor-studio',
    when: 'they have a photo of the room, or are on a desktop where a camera is no use',
  },
  {
    href: '/design',
    when: 'they already know roughly what they want and are specifying it',
  },
  {
    href: '/pricing',
    when: 'they ask what anything costs, or want the numbers before they talk to anyone',
  },
  {
    href: '/quote-check',
    when: 'they mention a quote from another contractor, or ask whether a price is fair',
  },
  {
    href: '/estimate',
    when: 'they are ready for a fixed written price',
  },
  {
    href: '/tools/floor-movement',
    when: 'they ask about gaps, cupping, humidity, wide boards or seasonal movement',
  },
  {
    href: '/service-areas',
    when: 'they name a town, ask whether Ecowoods comes to them, or mention travel',
  },
];

export type SiteFeature = Destination & { when: string };

/** The headline features, resolved against the navigation. */
export function headlineFeatures(): SiteFeature[] {
  const byHref = new Map(DESTINATIONS.map((d) => [d.href, d]));
  return HEADLINE.map((h) => {
    const d = byHref.get(h.href);
    return d ? { ...d, when: h.when } : null;
  }).filter((x): x is SiteFeature => x !== null);
}

/**
 * Everything in the chrome, searchable.
 *
 * Scored rather than filtered, because a homeowner does not type the label. A
 * match on the path segments is worth less than a match on the label, and a
 * match on the note — which is the sentence a human wrote about why the page
 * exists — is worth most of all.
 */
export function findOnSite(query: string, limit = 5): Destination[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!terms.length) return [];

  const scored = DESTINATIONS.map((d) => {
    const label = d.label.toLowerCase();
    const note = (d.note ?? '').toLowerCase();
    const path = d.href.toLowerCase().replace(/[/#-]+/g, ' ');
    let score = 0;
    for (const t of terms) {
      if (label.includes(t)) score += 3;
      if (note.includes(t)) score += 2;
      if (path.includes(t)) score += 1;
    }
    return { d, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.d);
}

/**
 * The block appended to the system prompt on every request.
 *
 * Written as instructions rather than as a list, because a list of URLs in a
 * prompt gets recited and a rule gets followed. The paths are real, derived,
 * and the model is told plainly that naming one is not optional when it is the
 * better answer — which is the same rule the prompt already applies to the six
 * services, extended to the things this site can do that a sentence cannot.
 */
export function siteCapabilitiesBlock(): string {
  const features = headlineFeatures();
  const lines = features.map((f) => `- ${f.href} — ${f.label}${f.note ? `: ${f.note}` : ''}. Send them here when ${f.when}.`);

  return `

WHAT THIS WEBSITE CAN DO, AND WHEN TO SEND SOMEONE TO IT

You are not the only thing on this site, and for several questions you are not
the best thing on it. When one of these answers the homeowner better than a
sentence from you can, NAME IT AND GIVE THE PATH. Write the path plainly, like
ecowoods.ca/floor-studio — the chat window turns it into a link. One per reply
at most, and it replaces the generic next step rather than being added to it.

${lines.join('\n')}

The live camera is the one to lead with when someone is undecided: they point
their phone at the room and the floor changes under them while they walk around
it, with the installed range updating as they change species, finish, pattern or
board width. Nothing is uploaded, it costs them nothing, and every floor it
shows is one Ecowoods can actually lay — no image model is involved, because a
floor that does not exist cannot be bought. Say that last part if they ask
whether it is AI: it is rendering, not generation, and that is why the price
under it means something.

If they ask for something else this site might have — a guide, a paper, a term,
a town, a corridor, a case study — call find_on_site and give them the path it
returns. Never invent a path. If find_on_site returns nothing, say so and offer
the measure.`;
}


/* ── turning what the assistant wrote into something you can tap ──────────── */

/**
 * Split a reply into text and the site paths inside it.
 *
 * The system prompt forbids markdown for a reason recorded there: the chat
 * bubble is 392px of plain text with no renderer, so `[a](b)` arrives as
 * literal brackets. The consequence nobody had followed through was that a page
 * the assistant recommended arrived as INERT TEXT — the homeowner was told
 * where to go and then had to retype it.
 *
 * So the widget links it, on the one shape the assistant is told to write:
 * ecowoods.ca/<path>. Nothing else is matched, and in particular no arbitrary
 * URL becomes clickable — a link from this widget can only ever point inside
 * this site, which is also what makes it safe against a model that has been
 * talked into emitting somebody else's domain.
 *
 * Pure and here rather than in the component so it can be held to a test.
 */
export type ReplyPart = { text: string } | { path: string };

/**
 * The one shape that becomes a link, and nothing else.
 *
 * The trailing negative lookahead is not decoration. Without it
 * `ecowoods.ca.evil.example.com/pricing` matches its first eleven characters,
 * and the widget renders the words "ecowoods.ca" as a link in the middle of
 * somebody else's hostname — the href stays internal, so it is not an open
 * redirect, but it lends this company's name to a phishing string inside its
 * own chat window. The test for it is in assistant-site.test.ts and it caught
 * this before it shipped. Anything that could continue a hostname — a letter, a
 * digit, a hyphen or a dot — after the domain or the path means this is not our
 * URL, and no link is made.
 */
const SITE_PATH = /\b(?:https?:\/\/)?(?:www\.)?ecowoods\.ca(\/[A-Za-z0-9\-._~/#]*)?(?![A-Za-z0-9\-.])/g;

export function splitReply(text: string): ReplyPart[] {
  if (!text.includes('ecowoods.ca')) return [{ text }];
  const out: ReplyPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  SITE_PATH.lastIndex = 0;
  while ((match = SITE_PATH.exec(text)) !== null) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) });
    let path = match[1] ?? '/';
    let trailing = '';
    /* A full stop after a path belongs to the sentence, not to the URL. */
    while (path.length > 1 && /[.,;:!?)]$/.test(path)) {
      trailing = path.slice(-1) + trailing;
      path = path.slice(0, -1);
    }
    out.push({ path });
    if (trailing) out.push({ text: trailing });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
