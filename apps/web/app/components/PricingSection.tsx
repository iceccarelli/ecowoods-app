'use client';

/**
 * PricingSection — "How much does it cost?", answered honestly.
 *
 * Desktop keeps the 3-up grid (glanceable, comparison at once). On mobile, where
 * three tall cards become a marathon scroll, it switches to the shared SwipeDeck
 * — the SAME engine Services/Reviews/Process/Gallery use, so pricing is one
 * thumb-swipe, not a new interaction to learn. The deck opens on the featured
 * tier so the first card a phone visitor sees is the one that converts.
 *
 * Why a TIERED RANGE, not one number: refinishing genuinely varies with
 * condition, stairs, species and finish. A single "$X/sqft" would either
 * under-quote (awkward upsell that kills the "fixed price" trust) or over-quote
 * (scares good leads). A range is honest AND answers the question — and because
 * Ecowoods runs dustless + salaried masters, it sits in the upper band and can
 * say WHY. That is the AWS move: transparent about being premium, not cheapest.
 *
 * EVERY NUMBER ON THIS COMPONENT IS NOW DERIVED. It used to carry four
 * hand-typed figures and a warning above them saying they were GTA market
 * ranges to be replaced before launch. The warning was stale — by the time this
 * was found, three of the four had been quietly edited to match the published
 * bands and the fourth had not. That is the worst possible state: a stale
 * instruction telling the next reader to change numbers that are now correct.
 *
 * THE FOURTH ONE WAS WRONG ON THE LIVE SITE.
 *
 * "A typical 1,000 sq ft main floor runs about $4,500–$7,000", printed directly
 * beneath a card stating $4.75–$7.50 per square foot. A thousand square feet at
 * the published band is $4,750–$7,500. The homepage of a company whose entire
 * pitch is "fixed price in writing" was showing two different prices for the
 * same job, on the same screen, four hundred pixels apart — and understating
 * the top of its own range by $500, which is a real quote a real estimator then
 * has to walk back in someone's living room.
 *
 * It is derived now. The tier figures come from content/constants/pricing.ts and
 * the worked example is multiplied out of the same band at render time, so the
 * arithmetic cannot disagree with the rate it is derived from.
 */

import SwipeDeck, { useIsMobile } from './SwipeDeck';
import {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  type PriceBand,
} from '@/content/constants/pricing';

/** "2.50–4.00" — the figure the card renders, with the $ and the unit around it. */
const rate = (b: PriceBand) => `${b.min.toFixed(2)}–${b.max.toFixed(2)}`;

/**
 * The worked example, multiplied out of the band rather than typed.
 *
 * `en-CA` with zero fraction digits produces "$4,750" — the same shape the
 * hand-typed version had, so nothing about the rendered sentence moves except
 * that it is now arithmetically true.
 */
const EXAMPLE_SQFT = 1000;
const cad = (n: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: FULL_SAND_FINISH.currency,
    maximumFractionDigits: 0,
  }).format(n);
const exampleRange = `${cad(FULL_SAND_FINISH.min * EXAMPLE_SQFT)}–${cad(FULL_SAND_FINISH.max * EXAMPLE_SQFT)}`;

type Tier = {
  id: string;
  name: string;
  tagline: string;
  pricePerSqFt: string;
  blurb: string;
  best: string;
  highlight: boolean;
};

const TIERS: Tier[] = [
  {
    id: 'recoat',
    name: SCREEN_RECOAT.label,
    tagline: 'Refresh a floor that’s still sound',
    pricePerSqFt: rate(SCREEN_RECOAT),
    blurb:
      'A light abrasion and a fresh topcoat. No full sand — right when the finish is worn but the wood underneath is healthy. Extends the floor 3–5 years.',
    best: 'Floors under ~10 years with surface wear only',
    highlight: false,
  },
  {
    id: 'standard',
    name: FULL_SAND_FINISH.label,
    tagline: 'The complete restoration',
    pricePerSqFt: rate(FULL_SAND_FINISH),
    blurb:
      'Sanded to bare wood, stained to your choice, three coats of premium finish — all dustless. This is what most Toronto main floors need every 7–10 years.',
    best: 'Most homes · scratches, greying, or a colour change',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium & Hardwood Install',
    tagline: 'New floors or specialty finishes',
    pricePerSqFt: rate(NEW_INSTALL),
    blurb:
      'New wide-plank hardwood, oil finishes like Rubio Monocoat, custom stain matching, stairs and repairs. Priced per project after we see the space.',
    best: 'New installs, oil finishes, stairs, board repair',
    highlight: false,
  },
];

/** the visual of a single tier — shared by the grid and the swipe deck */
function TierCard({ t }: { t: Tier }) {
  return (
    <>
      {t.highlight && <span className="price-flag">Most common</span>}
      <div className="price-card-head">
        <h3 className="price-name">{t.name}</h3>
        <p className="price-tagline">{t.tagline}</p>
      </div>
      <div className="price-figure">
        <span className="price-currency">$</span>
        <span className="price-amount">{t.pricePerSqFt}</span>
        <span className="price-unit">/ sq ft</span>
      </div>
      <p className="price-blurb">{t.blurb}</p>
      <div className="price-best">
        <span className="price-best-label">Best for</span>
        {t.best}
      </div>
    </>
  );
}

export default function PricingSection() {
  const { mounted, isMobile } = useIsMobile();

  const grid = (
    <div className="pricing-grid reveal">
      {TIERS.map((t) => (
        <div key={t.id} className={`price-card ${t.highlight ? 'is-featured' : ''}`}>
          <TierCard t={t} />
        </div>
      ))}
    </div>
  );

  // open the deck on the featured tier — the first card a phone visitor sees
  const featuredFirst = (() => {
    const i = TIERS.findIndex((t) => t.highlight);
    if (i <= 0) return TIERS;
    return [...TIERS.slice(i), ...TIERS.slice(0, i)];
  })();

  const deck = (
    <SwipeDeck
      items={featuredFirst}
      getKey={(t) => t.id}
      ariaLabel="Pricing tiers"
      srLabel={(t) => `${t.name}. ${t.pricePerSqFt} dollars per square foot. ${t.blurb}`}
      cardClassName="pfd-card--panel pfd-card--price"
      /* `tone` describes the SECTION BEHIND the deck, not the cards. The pricing
         section is `.section .section--card .pricing`, which has no background
         of its own and therefore sits on --bg. Marking it dark made
         .pfd--dark .pfd-count and .pfd--dark .pfd-hint paint
         rgba(245, 239, 230, …) — light text on a light page. axe measured
         "1 / 3" at 1.07:1 and "Swipe through pricing · 3 tiers" at 1.06:1:
         invisible. StandardDeck keeps tone="dark" because its section is.
         See audit/FINDINGS.md F-39. */
      cta={{ href: '#quote', label: 'Get your exact price in writing' }}
      hint={`Swipe through pricing · ${TIERS.length} tiers`}
      renderCard={(t) => (
        <div className={`price-card price-card--deck ${t.highlight ? 'is-featured' : ''}`}>
          <TierCard t={t} />
        </div>
      )}
    />
  );

  return (
    <section className="section section--card section--tint pricing" id="pricing">
      <div className="shell">
        <div className="section-head reveal">
          <span className="eyebrow">Straight Answer</span>
          <h2>
            What it costs. <span className="serif-italic">Before you call.</span>
          </h2>
          <p className="section-sub">
            Every other Toronto floor company makes you book a visit to hear a number. Here’s the
            range up front — the exact price is fixed in writing at your free in-home estimate, and
            it never moves after that.
          </p>
        </div>

        {/* desktop grid until mounted+mobile confirmed, to avoid a layout flash */}
        {mounted && isMobile ? deck : grid}

        <div className="pricing-foot reveal">
          <div className="pricing-foot-fact">
            <strong>
              A typical {EXAMPLE_SQFT.toLocaleString('en-CA')} sq ft main floor
            </strong>{' '}
            runs {exampleRange} at the {FULL_SAND_FINISH.label.toLowerCase()} band above, finished
            in 3–5 days start to furniture back in place.
          </div>
          <p className="pricing-note">
            What moves the number: floor condition, stairs, species hardness, a light-to-dark colour
            change, and board repairs. We walk every one of these with you on-site — no surprises,
            no change orders. That’s what “fixed price in writing” means.
          </p>
          {/* the deck carries its own CTA; the grid (desktop) needs this one */}
          {!(mounted && isMobile) && (
            <a href="#quote" className="pricing-cta">
              Get your exact price in writing
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
