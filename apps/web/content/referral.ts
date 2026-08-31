/**
 * content/referral.ts — the referral offer, stated once.
 *
 * WHY THE TERMS ARE A CONSTANT AND NOT COPY
 *
 * This file publishes a commercial promise: refer someone, and when their job
 * closes you receive something. The moment the amount appears in two places it
 * can differ in two places, and the version a customer read is the version they
 * are owed. A referral offer that pays a different number than the page said is
 * not a marketing inconsistency — it is a dispute with somebody who liked you
 * enough to send a friend, which is the single most expensive customer to lose.
 *
 * So the page, the form, the confirmation and the internal email all read from
 * here, and `scripts/verify-referral.mjs` fails the build if the reward figure
 * is typed as a literal anywhere else.
 *
 * THE CONDITIONS ARE PART OF THE OFFER, NOT THE SMALL PRINT. "After the
 * referred job closes" is stated in the same breath as the reward everywhere it
 * appears. An offer whose conditions are discovered later is the kind of thing
 * this whole project exists not to do.
 *
 * Owner-published terms. Changing them means changing them here, once.
 */

export const REFERRAL = {
  /** Credit against the referrer's own next job. */
  creditPercent: 5,
  /** Or, for someone with no next job, a flat amount. */
  flatCad: 250,
  currency: 'CAD',
  /** The one condition, stated wherever the reward is stated. */
  condition: 'after the referred job is completed and paid',
  /** The line that has to appear under the offer, in full. */
  legalLine:
    'Credit or amenity is applied after the referred job is completed and paid, cannot be combined with unpublished discounts, and has no cash value until then. One reward per completed referred job.',
} as const;

/** "5% credit or $250" — the ONE way the reward is written in prose. */
export const referralRewardLine = (): string =>
  `${REFERRAL.creditPercent}% credit or $${REFERRAL.flatCad}`;

/** The full sentence, reward and condition together. Never split these. */
export const referralOfferLine = (): string =>
  `${referralRewardLine()} ${REFERRAL.condition}`;
