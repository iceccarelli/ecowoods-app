import Link from 'next/link';
import { BUSINESS_NAP, yearsInBusiness } from '@ecowoods/shared/constants';
import { PRICING, PRICE_PROMISE } from '@/lib/pricing';
import { PRIMARY_AREAS, SERVICE_AREAS } from '@/lib/seo-data';

const money = (n: number) => `$${n.toFixed(2)}`;
const band = (k: keyof typeof PRICING) => `${money(PRICING[k].min)}–${money(PRICING[k].max)}`;

/**
 * The plain-language answer to "who is this, what do they do, where, and what
 * do I do next", in the first screenful after the hero. Every figure comes from
 * the same registries the rest of the site reads: the business constants, the
 * published price bands and the published service-area list.
 */
export function HomeIntro() {
  const places = PRIMARY_AREAS.slice(0, 5).map((a) => a.name);
  return (
    <section className="section-tight" aria-label="About Ecowoods">
      <div className="shell">
        <p className="tlx-lede">
          {BUSINESS_NAP.legalName} installs, refinishes and restores hardwood floors and stairs in{' '}
          {BUSINESS_NAP.region}, and has done so for {yearsInBusiness()} years. We work across{' '}
          <Link href="/service-areas">{SERVICE_AREAS.length} published service areas</Link>, including{' '}
          {places.join(', ')}. Prices are published: {band('screenAndRecoat')} per square foot for a screen and recoat,{' '}
          {band('fullSandAndFinish')} for a full sand and finish, and {band('newInstall')} for new hardwood.{' '}
          {PRICE_PROMISE} To start, <Link href="/estimate">request a free estimate</Link> or call{' '}
          <a href={BUSINESS_NAP.phoneHref}>{BUSINESS_NAP.phoneDisplay}</a>.
        </p>
      </div>
    </section>
  );
}
