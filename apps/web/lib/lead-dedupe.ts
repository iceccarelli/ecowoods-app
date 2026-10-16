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
      where: { email: string; phone: string | null; service: string | null; createdAt: { gte: Date } };
      select: { id: true };
      orderBy: { createdAt: 'desc' };
    }): Promise<{ id: string } | null>;
  };
}

/** Same email, phone and service inside the window is the same request. */
export async function findRecentDuplicate(
  client: DuplicateLookup,
  lead: { email: string; phone: string | null; service: string | null },
  now: Date = new Date(),
): Promise<string | null> {
  const hit = await client.quoteRequest.findFirst({
    where: {
      email: lead.email,
      phone: lead.phone,
      service: lead.service,
      createdAt: { gte: new Date(now.getTime() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  return hit?.id ?? null;
}
