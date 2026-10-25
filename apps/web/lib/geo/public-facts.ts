/**
 * lib/geo/public-facts.ts — the one plain, cited local line a market page may
 * carry, from Statistics Canada's 2021 Census.
 *
 * Only a municipality that is a census geography of its own gets one. A
 * district (Etobicoke, Ancaster) inherits its parent's figures in the internal
 * model and never gets a line here, because "Toronto has X" is not a fact about
 * Etobicoke. Nothing but the published counts and medians leaves this module:
 * no percentile, no score, no ranking. The vintage is stated in the sentence.
 */
import { MARKET_INPUTS } from '@/content/geo/market-inputs';

export interface LocalCensusLine {
  text: string;
  sources: Array<{ label: string; url: string }>;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

export function localCensusLine(slug: string, displayName: string): LocalCensusLine | null {
  const inputs = MARKET_INPUTS[slug];
  const detached = inputs?.detachedPrevalence;
  const income = inputs?.purchasingPower;
  const value = inputs?.housingValues;
  if (!detached || !income || !value) return null;
  if ([detached, income, value].some((x) => x.geography?.kind !== 'direct')) return null;

  const part = (v: typeof detached, metric: string) => v.raw?.components.find((c) => c.metric === metric);
  const single = part(detached, 'single_detached');
  const total = part(detached, 'structural_total');
  const inc = part(income, 'median_household_income');
  const val = part(value, 'median_dwelling_value');
  if (!single || !total || !inc || !val || total.value <= 0 || single.value > total.value) return null;

  const share = Math.round((single.value / total.value) * 100);
  return {
    text:
      `Statistics Canada's 2021 Census counts ${Math.round(total.value).toLocaleString('en-CA')} private households in ${displayName}, ` +
      `${share}% of them in single-detached houses. The median household income was ${money(inc.value)} (2020) ` +
      `and the median owner-estimated value of a home ${money(val.value)}.`,
    sources: [
      { label: 'Statistics Canada, Table 98-10-0240-01 (structural type of dwelling)', url: detached.source.url },
      { label: 'Table 98-10-0060-01 (household income)', url: income.source.url },
      { label: 'Table 98-10-0257-01 (value of dwelling)', url: value.source.url },
    ],
  };
}
