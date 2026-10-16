import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE, yearsInBusiness } from '@ecowoods/shared/constants';
import { SERVICE_AREAS, SERVICES, US_AREA_SLUGS, areaDisplayName, cityContent, type City } from '@/lib/seo-data';
import { SERVICE_PAGES, priceBand, priceBandIn, serviceFor, type ServicePage } from '@/lib/service-pages';
import { PRICE_PROMISE } from '@/lib/pricing';

/**
 * The opening answer: who, what, where, what it costs and the next step, in one
 * paragraph a reader (or an answer engine lifting the first paragraph) can use
 * without scrolling. Everything is read from the registries — the business
 * constants, the service list, the published price bands and the published
 * service-area list — so it cannot drift from the rest of the site.
 *
 * Counterpart of app/components/HomeIntro.tsx for service and area pages.
 */

const REFINISHING = SERVICE_PAGES.find((p) => p.slug === 'floor-refinishing')!;
const INSTALLATION = SERVICE_PAGES.find((p) => p.slug === 'hardwood-installation')!;

export function serviceOpening(page: ServicePage): string {
  const svc = serviceFor(page);
  const name = svc?.name ?? page.h1;
  const band = priceBand(page);
  const places = SERVICE_AREAS.slice(0, 5).map((a) => a.name).join(', ');
  const price = band
    ? `${name} is published at ${band}, fixed in writing after a free in-home measure.`
    : `${name} is priced after a free in-home measure, and the price is fixed in writing.`;
  return (
    `${name} is one of the ${SERVICES.length} services ${BUSINESS_NAP.legalName} provides across ${BUSINESS_NAP.region}. ` +
    `${svc?.blurb ?? ''} ` +
    `The company has worked on hardwood floors for ${yearsInBusiness()} years from ${BUSINESS_ADDRESS_LINE}, ` +
    `and takes this work in ${SERVICE_AREAS.length} published service areas, including ${places}. ` +
    `${price} ${PRICE_PROMISE} ` +
    `To start, request a free estimate or call ${BUSINESS_NAP.phoneDisplay}; the phone is answered ${HOURS_LINE}.`
  ).replace(/\s+/g, ' ').trim();
}

export function areaOpening(city: City): string {
  const isUS = US_AREA_SLUGS.has(city.slug);
  const where = areaDisplayName(city);
  const country = isUS ? 'US' : 'CA';
  const refinish = priceBandIn(REFINISHING, country);
  const install = priceBandIn(INSTALLATION, country);
  const hoods = (cityContent(city.slug)?.neighbourhoods ?? []).slice(0, 3);
  const local = hoods.length ? ` Streets we work include ${hoods.join(', ')}.` : '';
  const shop = isUS
    ? `The shop is in Toronto at ${BUSINESS_ADDRESS_LINE}, and the job is in ${city.name}.`
    : `The shop is at ${BUSINESS_ADDRESS_LINE}.`;
  return (
    `${BUSINESS_NAP.legalName} refinishes, installs and restores hardwood floors and stairs in ${where}, ` +
    `and has done hardwood work for ${yearsInBusiness()} years. ` +
    `${where} is one of ${SERVICE_AREAS.length} published service areas.${local} ` +
    `Services here are ${SERVICES.map((s) => s.name).join(', ')}. ` +
    `Published prices in ${isUS ? 'US' : 'Canadian'} dollars: ${refinish} for a full sand and finish and ${install} for new hardwood. ` +
    `${PRICE_PROMISE} ${shop} ` +
    `To start, request a free in-home estimate or call ${BUSINESS_NAP.phoneDisplay}, ${HOURS_LINE}.`
  ).replace(/\s+/g, ' ').trim();
}

export const wordCount = (s: string) => s.trim().split(/\s+/).length;
