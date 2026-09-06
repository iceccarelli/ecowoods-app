/**
 * lib/registry/types.ts — the universal primitive contract.
 *
 * WHY THIS EXISTS
 *
 * The site already has one source of truth per fact family: BUSINESS_NAP and
 * REVIEW_EVIDENCE in @ecowoods/shared/constants, PRICE_BANDS in
 * content/constants/pricing.ts, SERVICES / CITIES / CITY_CONTENT in
 * lib/seo-data.ts, CLAIMS in content/claims.ts. What it did not have was one
 * *shape* those facts are published in for machines: an id that never churns,
 * the canonical page that states the fact, who established it, when it was
 * last checked, and whether it is currently trusted.
 *
 * Every registry primitive is a PROJECTION of those modules. Nothing in
 * lib/registry originates a business fact. If a value here disagreed with the
 * page, the page would be wrong at the same time, because both read the same
 * constant. tests/registry-drift.test.ts and scripts/verify-agentic.mjs fail
 * the build if that stops being true.
 *
 * Contract (Ecowoods Master Execution Protocol v2 §11):
 *
 *   {
 *     "id": "service:floor-refinishing",
 *     "type": "Service",
 *     "data": { ... },
 *     "canonical_url": "https://ecowoods.ca/services/floor-refinishing",
 *     "source": { "type": "first_party", "url": "https://ecowoods.ca/..." },
 *     "provenance": { "verified_at": "2026-09-05" },
 *     "status": "verified"
 *   }
 */

/** Trust state of a primitive. `verified` is the default for anything that has a source and a date. */
export type PrimitiveStatus = 'verified' | 'unverified' | 'conflict' | 'deprecated' | 'unknown';

/** Where a fact comes from. Mirrors the source registry (Stage 11). */
export type SourceType =
  | 'first_party'
  | 'directory'
  | 'review_platform'
  | 'social_profile'
  | 'public_record'
  | 'press'
  | 'other';

export type PrimitiveType =
  | 'Organization'
  | 'Service'
  | 'Location'
  | 'Price'
  | 'Review'
  | 'Source'
  | 'Evidence'
  | 'FAQ'
  | 'Page'
  | 'Action';

export type SourceRef = {
  type: SourceType;
  /** The URL a reader or a machine opens to check the fact. */
  url: string;
  /** Human label for the source. */
  name?: string;
  /** Registry id of the Source primitive, where one exists. */
  source_id?: string;
};

export type Provenance = {
  /** ISO date the source was last read and found to still say this. */
  verified_at: string;
  /** How it was verified: owner confirmation, a live read, or derivation by code. */
  method?: 'owner_confirmed' | 'live_read' | 'derived' | 'published';
  /** content/claims.ts ids that back this primitive, where any do. */
  claim_ids?: string[];
  /** Free-text caveat the consumer must carry with the fact. */
  note?: string;
};

export type Primitive<T extends PrimitiveType, D> = {
  id: string;
  type: T;
  data: D;
  canonical_url: string;
  source: SourceRef;
  provenance: Provenance;
  status: PrimitiveStatus;
};

/* ── data shapes ─────────────────────────────────────────────────────────── */

export type OrganizationData = {
  legal_name: string;
  name: string;
  alternate_names: string[];
  founded_year: number;
  years_in_business: number;
  telephone_e164: string;
  telephone_display: string;
  email: string;
  address: {
    street: string;
    locality: string;
    region: string;
    postal_code: string;
    country: string;
  };
  geo: { latitude: number; longitude: number };
  hours: { days: string[]; opens: string; closes: string }[];
  timezone: string;
  service_region: string;
  crew_model: string;
  price_promise: string;
  same_as: string[];
  identifiers: { property: string; value: string }[];
  schema_id: string;
  logo_url: string;
  service_ids: string[];
  price_ids: string[];
};

export type ServiceData = {
  slug: string;
  name: string;
  /** The one-sentence description the HTML page shows. Identical to SERVICES[].blurb. */
  description: string;
  h1: string;
  standfirst: string;
  /** Registry id of the published price band, or null where the service is quoted per project. */
  price_id: string | null;
  price_band_text: string | null;
  /** Customer phrasings that resolve to this service. */
  aliases: string[];
  /** Situations where this is the wrong service, with the right one named. */
  wrong_when: { situation: string; use_instead: string }[];
  related_service_ids: string[];
  /** Case studies, papers and guides that evidence the method. */
  evidence_ids: string[];
  page_id: string;
  markdown_url: string;
};

export type LocationTier = 'country' | 'province' | 'region' | 'municipality' | 'district' | 'neighbourhood';

/**
 * `published`  — has a service-area page and appears in areaServed.
 * `region`     — a region the published areas sit inside (GTA, Toronto).
 * `assessment` — a real place in Southern Ontario without a published page;
 *                served on assessment, never claimed as covered.
 * `parent`     — hierarchy node only (Ontario, Canada).
 */
export type LocationCoverage = 'published' | 'region' | 'assessment' | 'parent';

export type LocationData = {
  slug: string;
  name: string;
  tier: LocationTier;
  coverage: LocationCoverage;
  parent_id: string | null;
  /** Whether the entity graph declares this as a schema.org City in areaServed. */
  in_area_served: boolean;
  /** Only where a page adds housing-stock, substrate or climate information. */
  local_notes: { intro: string; housing_note: string; local_consideration?: string; neighbourhoods: string[] } | null;
  aliases: string[];
  page_id: string | null;
  markdown_url: string | null;
};

export type PriceData = {
  band_key: string;
  label: string;
  service_id: string;
  min: number;
  max: number;
  currency: 'CAD';
  unit: 'sq ft';
  unit_code: 'FTK';
  formatted: string;
  /** What the band covers and what moves it. */
  conditions: string[];
  /** The sentence that must travel with the number. */
  caveat: string;
  is_quote: false;
};

export type ReviewData = {
  platform: string;
  profile_url: string;
  rating: number;
  out_of: number;
  count: number;
  read_on: string;
  latest_review_at: string | null;
  identity_match: 'confirmed' | 'owner_attested' | 'unverified';
  /** Never blended into an aggregateRating on this site; see WHY in packages/shared/constants. */
  published_as: 'cited_statistic';
};

export type SourceData = {
  name: string;
  url: string;
  source_type: SourceType;
  identity_match: 'confirmed' | 'owner_attested' | 'unverified';
  authority_level: 'primary' | 'high' | 'medium' | 'low';
  last_verified: string;
  verification_status: 'verified' | 'pending_owner_alignment' | 'unverified';
  note?: string;
};

export type EvidenceKind = 'claim' | 'case_study' | 'paper' | 'guide' | 'review' | 'measurement';

export type EvidenceData = {
  kind: EvidenceKind;
  claim: string;
  first_party: boolean;
  supports_service_ids: string[];
  supports_location_ids: string[];
  /** The URL to cite. */
  citation_url: string;
  third_party_url?: string;
  published_at?: string;
  value?: string | number;
};

export type FAQData = {
  question: string;
  answer: string;
  /** Pages whose visible text carries this Q/A. */
  visible_on: string[];
  service_ids: string[];
  href?: string;
};

export type PageData = {
  path: string;
  title: string;
  kind: 'home' | 'service' | 'service_hub' | 'area' | 'area_hub' | 'pricing' | 'about' | 'reviews' | 'estimate' | 'contact' | 'commercial' | 'evidence' | 'machine';
  markdown_url: string | null;
  /** Stable fragment ids an agent may cite on this page. */
  fragments: string[];
  p0: boolean;
};

export type ActionData = {
  name: string;
  schema_type: 'QuoteAction' | 'CommunicateAction' | 'ReserveAction';
  target: string;
  method: 'GET' | 'POST' | 'tel' | 'mailto';
  description: string;
  /** What the customer gets and when. */
  outcome: string;
};

export type OrganizationPrimitive = Primitive<'Organization', OrganizationData>;
export type ServicePrimitive = Primitive<'Service', ServiceData>;
export type LocationPrimitive = Primitive<'Location', LocationData>;
export type PricePrimitive = Primitive<'Price', PriceData>;
export type ReviewPrimitive = Primitive<'Review', ReviewData>;
export type SourcePrimitive = Primitive<'Source', SourceData>;
export type EvidencePrimitive = Primitive<'Evidence', EvidenceData>;
export type FAQPrimitive = Primitive<'FAQ', FAQData>;
export type PagePrimitive = Primitive<'Page', PageData>;
export type ActionPrimitive = Primitive<'Action', ActionData>;

export type AnyPrimitive =
  | OrganizationPrimitive
  | ServicePrimitive
  | LocationPrimitive
  | PricePrimitive
  | ReviewPrimitive
  | SourcePrimitive
  | EvidencePrimitive
  | FAQPrimitive
  | PagePrimitive
  | ActionPrimitive;

/** Stage 4 — the identity graph. */
export type GraphEdge = {
  from: string;
  predicate: 'offers' | 'serves' | 'hasPrice' | 'supportedBy' | 'hasSource' | 'hasPage' | 'supportsAction' | 'within' | 'relatedTo' | 'answers';
  to: string;
};
