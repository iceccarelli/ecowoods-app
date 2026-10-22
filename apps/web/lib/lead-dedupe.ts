/**
 * A double-tapped Send, a retry after a 429, or a second tab all post the same
 * lead twice. The first is real; the second must not become a second row, a
 * second estimator email and a second SMS alert. Uses the existing
 * QuoteRequest table — no second store, no migration.
 */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export interface DuplicateLookup {
  quoteRequest: {
    findFirst(args: {
      where: {
        email: string;
        phone: string | null;
        service: string | null;
        createdAt: { gte: Date };
        OR?: Array<{ address: { equals: string; mode: 'insensitive' } } | { city: { equals: string; mode: 'insensitive' } }>;
      };
      select: { id: true };
      orderBy: { createdAt: 'desc' };
    }): Promise<{ id: string } | null>;
  };
}

/**
 * Same email, phone and service inside the window is the same request — unless
 * the two name different properties. `place` is the postal code / city the
 * visitor typed (the form stores it on `address`, the assistant on `city`); a
 * household asking for a second floor at another address within ten minutes is
 * a second job, and merging it into the first would drop it behind a "saved".
 * Omit `place` to keep the contact-only rule.
 */
export async function findRecentDuplicate(
  client: DuplicateLookup,
  lead: { email: string; phone: string | null; service: string | null; place?: string | null },
  now: Date = new Date(),
): Promise<string | null> {
  const place = lead.place?.trim();
  const hit = await client.quoteRequest.findFirst({
    where: {
      email: lead.email,
      phone: lead.phone,
      service: lead.service,
      createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
      ...(place
        ? {
            OR: [
              { address: { equals: place, mode: 'insensitive' as const } },
              { city: { equals: place, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return hit?.id ?? null;
}
