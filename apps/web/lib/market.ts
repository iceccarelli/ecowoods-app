/**
 * Market inputs — the commodity series that move an installed floor price.
 *
 * WHY THIS EXISTS
 *
 * "Why is my quote higher than the one I got last year?" is the most common
 * question in this trade and the one almost nobody answers honestly. The usual
 * answer is a shrug about "material costs". The real answer is that a hardwood
 * floor is an assembly of traded inputs — sawn wood, petrochemical-derived
 * finish and adhesive, freight — most of it priced in US dollars, and every one
 * of those moves independently of the installer.
 *
 * Publishing the actual indices, with the mechanism explained, does something a
 * price list cannot: it makes the quote legible. A homeowner who can see that
 * the forestry index moved can evaluate a price change instead of suspecting
 * one. That is the same trade AWS made by publishing per-unit pricing into an
 * industry that quoted everything bespoke.
 *
 * SOURCE DISCIPLINE
 *
 * One source, one endpoint, no key: the Bank of Canada's Valet API. Every
 * series below was queried against it and its exact label recorded on the
 * `verifiedAt` date. Nothing is derived from a secondary aggregator, and no
 * series is included whose identifier could not be confirmed at the source —
 * the same rule as lib/standards.ts, for the same reason.
 *
 * NOT FINANCIAL INFORMATION. These indices are published here to explain the
 * movement of a construction quote. They are not investment information and
 * nothing on the page is a recommendation to buy or sell anything.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not convert an index into a dollar figure for a floor. The
 * relationship between a commodity index and one installed job is real but not
 * linear — labour, substrate condition and scope dominate at the job level, and
 * the published installed-cost ranges already live in the papers. Drawing a
 * line from "forestry index +6%" to "your floor costs 6% more" would be a
 * fabrication dressed as data.
 */

export type MarketSeries = {
  /** Bank of Canada Valet series identifier. */
  id: string;
  /** Short display name. */
  name: string;
  /** The exact label the Bank of Canada returns for this series. */
  sourceLabel: string;
  /** Daily or monthly, as published. */
  frequency: 'daily' | 'monthly';
  /** What this input actually is, in the floor. */
  drives: string;
  /** Why it moves — the mechanism, not a forecast. */
  volatility: string;
  /** Where in our own published work this input shows up. */
  paperRef?: { paper: string; section: string; label: string };
  verifiedAt: string;
};

export const VALET_BASE = 'https://www.bankofcanada.ca/valet';
export const VALET_DOCS = 'https://www.bankofcanada.ca/valet/docs';

const P_COST = 'hardwood-selection-and-cost-framework-gta';

export const SERIES: MarketSeries[] = [
  {
    id: 'M.FOPR',
    name: 'Forestry commodity index',
    sourceLabel: 'Monthly BCPI Forestry - v52673502',
    frequency: 'monthly',
    drives:
      'The sawn wood itself — solid boards, and the hardwood wear layer and cross-ply core of an engineered plank.',
    volatility:
      'Forestry prices respond to housing starts, sawmill capacity, log supply and trade policy, none of which move together and none of which an installer influences. A mill curtailment and a housing-start surge can land in the same quarter and push the index hard in one direction.',
    paperRef: {
      paper: P_COST,
      section: 'installed-cost',
      label: 'Installed cost in the GTA',
    },
    verifiedAt: '2026-08-20',
  },
  {
    id: 'M.ENER',
    name: 'Energy commodity index',
    sourceLabel: 'Monthly BCPI Energy - v52673498',
    frequency: 'monthly',
    drives:
      'Two things at once: freight on every pallet that reaches the GTA, and the petrochemical feedstock behind polyurethane finishes, adhesives and moisture-barrier membranes.',
    volatility:
      'This is the most volatile input in the assembly and the least visible in a quote. It moves on geopolitics and refinery capacity rather than on anything in the flooring trade, and it reaches a floor twice — once as the finish system and once as the truck.',
    paperRef: {
      paper: P_COST,
      section: 'fixed-price',
      label: 'What a fixed price actually protects',
    },
    verifiedAt: '2026-08-20',
  },
  {
    id: 'FXUSDCAD',
    name: 'US dollar in Canadian dollars',
    sourceLabel: 'USD/CAD',
    frequency: 'daily',
    drives:
      'Almost everything imported. Most engineered product, most finish systems and most machine consumables are priced in US dollars before they reach a Canadian invoice.',
    volatility:
      'A quote written in Canadian dollars against inventory bought in US dollars carries currency risk that the homeowner never sees. This is a large part of why an open-ended price is open-ended — and why a fixed one has to be underwritten by someone.',
    paperRef: {
      paper: P_COST,
      section: 'fixed-price',
      label: 'What a fixed price actually protects',
    },
    verifiedAt: '2026-08-20',
  },
];

export const getSeries = (): MarketSeries[] => SERIES;
export const seriesById = (id: string) => SERIES.find((s) => s.id === id);

/* ── the shape the route and the page share ──────────────────────────────── */

export type Observation = { date: string; value: number };

export type SeriesResult = {
  id: string;
  /** null when the source could not be reached — never a stale number. */
  latest: Observation | null;
  previous: Observation | null;
  /** Percentage change from `previous` to `latest`, or null. */
  changePct: number | null;
  history: Observation[];
  /** Present only when the fetch failed. */
  error?: string;
};

/**
 * Fetch from the Bank of Canada.
 *
 * FAILURE IS AN OUTPUT, NOT AN EXCEPTION. If the source is unreachable the
 * series comes back with `latest: null` and an `error`, and the page says so in
 * words. The alternative — falling back to a cached figure without saying it is
 * cached — is the same defect as the stale runtime report (F-41): a number that
 * is present is trusted, whether or not it is current.
 */
export async function fetchSeries(ids: string[], recent = 24): Promise<SeriesResult[]> {
  const url = `${VALET_BASE}/observations/${ids.join(',')}/json?recent=${recent}`;
  let payload: { observations?: Record<string, unknown>[] } | null = null;
  let error: string | undefined;

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      // One hour. The monthly series change monthly and the daily one once a
      // day; anything faster is load on a public good for no benefit.
      next: { revalidate: 3600 },
    });
    if (!res.ok) error = `Bank of Canada returned ${res.status}`;
    else payload = await res.json();
  } catch (e) {
    error = e instanceof Error ? e.message : 'network error';
  }

  return ids.map((id) => {
    if (!payload?.observations) {
      return { id, latest: null, previous: null, changePct: null, history: [], error: error ?? 'no data' };
    }
    const history: Observation[] = [];
    for (const row of payload.observations) {
      const d = row.d as string | undefined;
      const cell = row[id] as { v?: string } | undefined;
      const raw = cell?.v;
      if (!d || raw === undefined || raw === '') continue;
      const value = Number(raw);
      if (Number.isFinite(value)) history.push({ date: d, value });
    }
    history.sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = history.at(-1) ?? null;
    const previous = history.at(-2) ?? null;
    const changePct =
      latest && previous && previous.value !== 0
        ? ((latest.value - previous.value) / previous.value) * 100
        : null;
    return {
      id,
      latest,
      previous,
      changePct,
      history,
      ...(latest ? {} : { error: error ?? 'series not present in response' }),
    };
  });
}
