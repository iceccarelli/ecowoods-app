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
  {
    id: 'nhla-rules-2023',
    body: 'National Hardwood Lumber Association',
    designation: '2023 Rules',
    title: 'Rules for the Measurement & Inspection of Hardwood & Cypress',
    governs:
      'How a hardwood board is graded as lumber: minimum board size, minimum clear cutting size, and the required clear-face yield expressed in twelfths \u2014 FAS at 83-1/3%, No. 1 Common at 66-2/3%, No. 2A Common at 50%, No. 3A Common at 33-1/3%.',
    relevance:
      'This is the grade fixed at the sawmill, before any flooring mill touches the board, and it never improves downstream. It is also the grade nobody quotes to a homeowner \u2014 the number on a flooring quote is an NWFA/NOFMA appearance grade, which measures something else entirely. Knowing that the two systems exist is the difference between reading a quote and taking one on trust.',
    status: 'current',
    edition: 'Effective January 1, 2023',
    sourceUrl: 'https://nhla.com/wp-content/uploads/2023/07/2023-Rulesbook_English_web.pdf',
    verifiedAt: '2026-08-27',
    pillars: ['specification'],
    note: 'The Canadian Hardwood Bureau states that hardwood lumber grading standards in Canada are published and overseen by the NHLA. We found no Canadian statute or regulation making the rules mandatory; on the evidence we have this is a voluntary trade-association standard, which is a reason to name it in a contract rather than a reason to ignore it.',
  },
  {
    id: 'nwfa-nofma-unfinished-2018',
    body: 'National Wood Flooring Association',
    designation: 'NWFA/NOFMA',
    title: 'International Standards for Unfinished Solid Wood Flooring',
    governs:
      'Appearance grades for finished flooring by species group \u2014 Clear, Select, No. 1 Common and No. 2 Common for oak; Special Clear and Select & Better for hard maple, beech and birch \u2014 together with manufactured moisture content of 6% to 9%, thickness of .750" \u00b1 .015", and the definitions of strip, plank and wide plank.',
    relevance:
      'The document behind every honest flooring quote in this market. Its governing sentence is the one homeowners are never told: appearance alone determines the grades of hardwood flooring, since all grades are equally strong and serviceable in any application. A No. 2 Common floor is a character decision, not a compromise.',
    status: 'current',
    edition: 'Revised April 2018',
    sourceUrl: 'https://nwfa.org/wp-content/uploads/2020/03/NWFA-NOFMA-Unfinished-Standard-Final-April-2018.pdf',
    verifiedAt: '2026-08-27',
    pillars: ['specification', 'moisture'],
    note: 'This document replaces all editions of the Official Flooring Grading Rules previously published by the Wood Flooring Manufacturers Association. NWFA separately lists NOFMA-certified manufacturers, including Lauzon of Papineauville, Quebec and Superior Hardwood Flooring / Herwynen Saw Mill Ltd. of Rockwood, Ontario.',
  },
  {
    id: 'fpl-wood-handbook',
    body: 'USDA Forest Service, Forest Products Laboratory',
    designation: 'FPL-GTR-190',
    title: 'Wood Handbook \u2014 Wood as an Engineering Material, Chapter 5: Mechanical Properties of Wood',
    governs:
      'The measured mechanical properties of North American species, including side hardness at 12% moisture content \u2014 the modified Janka test, defined as the load required to embed an 11.28 mm ball to half its diameter.',
    relevance:
      'Every hardness number this site publishes traces to Table 5-3b of this document: hickory 1,880 lbf, hard maple 1,450, white oak 1,360, white ash 1,320, red oak 1,290, black walnut 1,010. It is the primary source behind figures that the rest of the industry restates without attribution.',
    status: 'revision-open',
    edition: 'GTR-190 (2010)',
    sourceUrl: 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf',
    verifiedAt: '2026-08-27',
    pillars: ['specification'],
    note: 'Marked revision-open because a newer edition exists \u2014 FPL-GTR-282 (2021) \u2014 and we publish the 2010 values deliberately. Extracting hardness from the 2021 chapter returned pairs that do not convert between units, indicating adjacent columns of Table 5-3 rather than hardness; the GTR-190 values were re-verified against two independently hosted copies that agreed exactly. Anyone re-checking these numbers should expect the same column slip. The American Hardwood Export Council publishes the same figures in newtons; those are a unit conversion of this dataset, not an independent measurement.',
  },
  {
    id: 'tsca-title-vi-formaldehyde',
    body: 'United States Environmental Protection Agency',
    designation: '40 CFR \u00a7 770.10',
    title: 'Formaldehyde Standards for Composite Wood Products \u2014 emission standards',
    governs:
      'Formaldehyde emission limits for the composite panels used as engineered flooring cores, tested to ASTM E1333-14: hardwood plywood 0.05 ppm, medium-density fibreboard 0.11 ppm, thin MDF 0.13 ppm, particleboard 0.09 ppm.',
    relevance:
      'An engineered board is a hardwood wear layer over a manufactured core, and the core is governed by emissions law rather than by any flooring rule. This is the certificate to ask a supplier for, by name.',
    status: 'current',
    edition: 'Current eCFR text; limits apply to product sold, supplied, offered for sale or manufactured on or after June 1, 2018',
    sourceUrl: 'https://www.ecfr.gov/current/title-40/part-770/section-770.10',
    verifiedAt: '2026-08-27',
    pillars: ['specification'],
    note: 'This is United States law. We searched for and did not find a Canadian federal instrument setting an equivalent limit, and we do not assert that TSCA Title VI binds product sold in Canada. The EPA states it worked with the California Air Resources Board so the national rule is consistent with California\u2019s requirements.',
  },
  {
    id: 'ansi-hpva-hp1-2024',
    body: 'Decorative Hardwoods Association / American National Standards Institute',
    designation: 'ANSI/HPVA HP-1-2024',
    title: 'American National Standard for Hardwood and Decorative Plywood',
    governs:
      'The principal types, face grades, back grades, inner ply grades and constructions of plywood made primarily with hardwood faces, including constructions with an odd number of plies where all inner plies except the innermost occur in pairs.',
    relevance:
      'The nearest published standard to the cross-ply core that gives an engineered floor its dimensional stability. Its scope does not name flooring, which is itself worth knowing: the construction homeowners are sold on has no flooring-specific standard behind it.',
    status: 'current',
    edition: 'Approved August 20, 2024',
    sourceUrl: 'https://www.decorativehardwoods.org/sites/default/files/2024-10/ANSI-HPVA%20HP-1-2024.pdf',
    verifiedAt: '2026-08-27',
    pillars: ['specification', 'substrate'],
    note: 'The copy read truncated before Section 5, Definitions, so this entry makes no claim about how the standard defines crossband, veneer core or ply. Re-read the full document before citing those terms to it.',
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
