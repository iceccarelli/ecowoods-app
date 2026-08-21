/**
 * External standards register — the bodies and documents this work answers to.
 *
 * WHY THIS IS A REGISTER AND NOT A NEWS FEED
 *
 * The obvious build is an aggregator: pull headlines from the trade press,
 * republish them, look current. Three reasons that is the wrong move, and they
 * compound:
 *
 *   1. It makes this site a SECONDARY source. AWS's "What's New" is AWS's own
 *      announcements — its authority comes from being the primary source, not
 *      from mirroring other people's. An aggregator competes with its own
 *      inputs and loses, because the reader can go upstream.
 *   2. It poisons the corpus. Every claim on this site traces to a paper
 *      published here and is enforced by a build guard. Auto-ingested third-
 *      party claims cannot be, and one unverified figure carried under this
 *      name discounts everything around it — which is the exact failure mode
 *      the whole architecture exists to prevent.
 *   3. Republishing article text is a copyright problem nobody needs.
 *
 * What actually builds authority is the opposite move: **be the map of the
 * standards landscape.** Which bodies govern this trade, which document says
 * what, which of our own framework criteria depend on it, where the primary
 * source is, and — the part nobody else publishes — WHEN WE LAST CHECKED.
 *
 * That last field is the product. `verifiedAt` is a claim about our own
 * diligence, not about the standard, and scripts/verify-standards.mjs surfaces
 * every entry that has gone stale so re-checking is a build-visible task rather
 * than something someone remembers. A register that silently rots is worse than
 * no register: it asserts currency it does not have.
 *
 * CONTENT RULE
 *
 * Every entry carries the exact document title as published by the issuing
 * body, a link to that body's own page, and the date it was verified there.
 * Nothing is summarised from a secondary source. Where an edition or a detail
 * could not be confirmed at the primary source, `note` says so plainly rather
 * than filling the gap.
 */

export type StandardStatus = 'current' | 'revision-open' | 'unverified-edition';

export type Standard = {
  id: string;
  /** Issuing body, e.g. "ASTM International". */
  body: string;
  /** Designation as the body writes it, e.g. "F2170-19a". Empty for non-numbered guidance. */
  designation?: string;
  /** The exact published title. Never paraphrased. */
  title: string;
  /** What it governs, in one sentence, in our words. */
  governs: string;
  /** Why it matters to a floor in this city. */
  relevance: string;
  status: StandardStatus;
  /**
   * The edition exactly as the document prints it — "Revised © 2025", not
   * "2025 edition". Present only where the document itself has been read; an
   * entry whose status is 'unverified-edition' must not carry this field,
   * which is the whole point of that status existing.
   */
  edition?: string;
  /** The issuing body's own page. Never a reseller, never a blog. */
  sourceUrl: string;
  /** ISO date this entry was last checked against sourceUrl. */
  verifiedAt: string;
  /** Framework pillar ids this standard underwrites. */
  pillars: string[];
  /** Framework criterion ids, where the mapping is that specific. */
  criteria?: string[];
  note?: string;
};

export const STANDARDS: Standard[] = [
  {
    id: 'astm-f2170',
    body: 'ASTM International',
    designation: 'F2170-19a',
    title:
      'Standard Test Method for Determining Relative Humidity in Concrete Floor Slabs Using in situ Probes',
    governs:
      'How relative humidity inside a concrete slab is measured, using probes placed in situ rather than a surface reading.',
    relevance:
      'This is the test behind "was the subfloor moisture-tested" on a concrete slab. A surface reading is not this test, and a contractor who has done one has not done the other.',
    status: 'current',
    sourceUrl: 'https://store.astm.org/f2170-19a.html',
    verifiedAt: '2026-08-20',
    pillars: ['moisture', 'substrate'],
    criteria: ['1.1', '1.3'],
  },
  {
    id: 'astm-f1869',
    body: 'ASTM International',
    designation: 'F1869',
    title:
      'Standard Test Method for Measuring Moisture Vapor Emission Rate of Concrete Subfloor Using Anhydrous Calcium Chloride',
    governs:
      'The calcium-chloride test — how much moisture vapour a concrete subfloor emits over a measured period.',
    relevance:
      'The older of the two concrete moisture tests, and still specified by some manufacturers. Which test a warranty requires is a question worth asking before the slab is covered.',
    status: 'revision-open',
    sourceUrl: 'https://store.astm.org/f1869-22.html',
    verifiedAt: '2026-08-20',
    pillars: ['moisture', 'substrate'],
    criteria: ['1.1'],
    note: 'ASTM lists an open revision work item (WK96566) against this standard. The edition in force may change; check the issuing body before relying on a specific year.',
  },
  {
    id: 'astm-f710',
    body: 'ASTM International',
    designation: 'F710-21',
    title: 'Standard Practice for Preparing Concrete Floors to Receive Resilient Flooring',
    governs:
      'Preparation of a concrete floor before a covering goes down — flatness, cleanliness, and the condition the slab has to be in.',
    relevance:
      'The substrate-condition half of pillar 2. Slab flatness discovered after a deposit is the most common source of change orders on a hardwood job, and this is the document that defines what "prepared" means.',
    status: 'current',
    sourceUrl: 'https://store.astm.org/f0710-21.html',
    verifiedAt: '2026-08-20',
    pillars: ['substrate'],
    criteria: ['2.3'],
  },
  {
    id: 'nwfa-guidelines',
    body: 'National Wood Flooring Association (NWFA)',
    // Was 'NWFA technical guidelines and publications', status
    // 'unverified-edition', pointing at nwfa.org — a landing page that does not
    // enumerate editions, so the entry could not name one. The document itself
    // has since been read at the URL below: its cover reads WOOD FLOORING
    // INSTALLATION GUIDELINES, and its copyright line reads 'Revised © 2025'.
    // Publisher confirmed on the same page as the National Wood Flooring
    // Association, St. Louis, Missouri. That is a primary source on the issuing
    // body's own domain, which is the standard this register holds itself to,
    // so the edition is now asserted rather than deferred.
    title: 'Wood Flooring Installation Guidelines',
    governs:
      'Installation of wood flooring over wood, concrete and radiant substrates: acclimation, moisture testing, subfloor flatness and preparation, fastening schedules and method selection.',
    relevance:
      'The trade body whose guidelines most manufacturer warranties reference. Acclimation periods, subfloor requirements and installation method by substrate all trace here.',
    status: 'current',
    edition: 'Revised © 2025',
    sourceUrl: 'https://nwfa.org/wp-content/uploads/2026/02/NWFA-Installation-Guidelines.pdf',
    verifiedAt: '2026-08-21',
    pillars: ['moisture', 'substrate', 'specification', 'containment'],
    note: 'The NWFA also publishes separate Sand & Finish and Wood Species guidelines; this entry covers the installation document only. Membership may be required for some NWFA publications — confirm the applicable document before citing it in a specification.',
  },
];

export const getStandards = (): Standard[] => STANDARDS;
export const getStandard = (id: string): Standard | undefined =>
  STANDARDS.find((s) => s.id === id);

/** Days since an entry was verified against its primary source. */
export const stalenessDays = (s: Standard, now: Date): number =>
  Math.floor((now.getTime() - new Date(s.verifiedAt).getTime()) / 86_400_000);

/** Entries due for re-verification. 180 days is the review interval. */
export const REVIEW_INTERVAL_DAYS = 180;
