# The shop prices that are already in the database

`seed-products.ts` now refuses to write without `SHOP_PRICES_ARE_REAL=1`. That
guards the write path. It does nothing about the rows that are already there,
because changing a live business's prices is not a script's decision.

## What is actually in production, as at 2026-09-14

Seventeen active `Product` rows, and every one of their `basePrice` values
matches `seed-products.ts` exactly — the placeholders were seeded and never
replaced. The shop renders from those rows on `/mypage`, behind sign-in, and
`/api/shop/checkout` creates a Stripe session from them. Prices are recomputed
server-side from the rows, so a customer cannot tamper with them; they can only
be charged the placeholder.

Nothing has been bought through it. The seven `Order` rows are all `PENDING`,
all created on one day, and none carries a `stripePaymentIntentId` — abandoned
checkout sessions, not sales. The three `COMPLETED` payments in the database are
against `Invoice` rows, which is the estimator flow with prices a person set.

So: live, reachable, priced from invented numbers, and it has not yet cost
anything.

## The two ways to close it

**Set the real prices.** Edit `basePrice` and `priceDelta` in
`seed-products.ts` to what Ecowoods charges, then:

```bash
SHOP_PRICES_ARE_REAL=1 npx tsx prisma/seed-products.ts
```

The upsert is keyed on `slug` and never deletes, so it corrects the existing
rows in place.

**Or take the shop down until they exist.** One statement, reversible:

```sql
update ecowoods."Product" set active = false;
```

`/api/shop/checkout` filters on `active`, so this closes the path without
deleting anything. Flip it back per row as each price is confirmed.

Doing neither is also a decision, and it is the one currently in force.
