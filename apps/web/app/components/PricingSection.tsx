'use client';

/**
 * PricingSection — "How much does it cost?", answered honestly.
 *
 * The single highest-value thing the site was missing. Every GTA competitor
 * hides price behind "contact for a quote"; Ecowoods' whole promise is "fixed
 * price in writing" — so NOT showing a number was the site contradicting its own
 * headline. The research (2026): "offer and policy details visible before final
 * commitment."
 *
 * Why a TIERED RANGE, not one number: refinishing genuinely varies with
 * condition, stairs, species and finish, so a single "$X/sqft" would either
 * under-quote (awkward upsell that kills the "fixed price" trust) or over-quote
 * (scares good leads). A range is honest AND answers the question — and because
 * Ecowoods runs dustless + salaried masters, it sits in the upper band and can
 * say WHY. That is the AWS move: transparent about being premium, not cheapest.
 *
 * ⚠️ NUMBERS BELOW ARE PUBLISHED GTA MARKET RANGES (2026), NOT ECOWOODS' OWN
 *    RATES. Replace `pricePerSqFt` / `from` on each tier with your real pricing
 *    before this goes live, or the site states market data as if it were yours.
 */

const TIERS = [
  {
    id: 'recoat',
    name: 'Screen & Recoat',
    tagline: 'Refresh a floor that’s still sound',
    pricePerSqFt: '2–3', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'A light abrasion and a fresh topcoat. No full sand — right when the finish is worn but the wood underneath is healthy. Extends the floor 3–5 years.',
    best: 'Floors under ~10 years with surface wear only',
    highlight: false,
  },
  {
    id: 'standard',
    name: 'Full Sand & Finish',
    tagline: 'The complete restoration',
    pricePerSqFt: '4.50–7', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'Sanded to bare wood, stained to your choice, three coats of premium finish — all dustless. This is what most Toronto main floors need every 7–10 years.',
    best: 'Most homes · scratches, greying, or a colour change',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium & Hardwood Install',
    tagline: 'New floors or specialty finishes',
    pricePerSqFt: 'from 8', // ⚠️ market range — replace with Ecowoods rate
    blurb:
      'New wide-plank hardwood, oil finishes like Rubio Monocoat, custom stain matching, stairs and repairs. Priced per project after we see the space.',
    best: 'New installs, oil finishes, stairs, board repair',
    highlight: false,
  },
];

export default function PricingSection() {
  return (
    <section className="section section--card pricing" id="pricing">
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

        <div className="pricing-grid reveal">
          {TIERS.map((t) => (
            <div key={t.id} className={`price-card ${t.highlight ? 'is-featured' : ''}`}>
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
            </div>
          ))}
        </div>

        <div className="pricing-foot reveal">
          <div className="pricing-foot-fact">
            <strong>A typical 1,000 sq ft main floor</strong> runs about $4,500–$7,000, finished in
            3–5 days start to furniture back in place.
          </div>
          <p className="pricing-note">
            What moves the number: floor condition, stairs, species hardness, a light-to-dark colour
            change, and board repairs. We walk every one of these with you on-site — no surprises,
            no change orders. That’s what “fixed price in writing” means.
          </p>
          <a href="#quote" className="pricing-cta">
            Get your exact price in writing
          </a>
        </div>
      </div>
    </section>
  );
}
