import { NextResponse } from 'next/server';
import { frameworkScoringSchema } from '@ecowoods/shared/schemas';
import { FRAMEWORK_VERSION, criterionCount, allCriteria, score, type Answer } from '@/lib/framework';
import { recordFrameworkScoring } from '@/lib/floor-graph';
import { grantConsent } from '@/lib/floor-graph/consent';
import { CITIES } from '@/lib/seo-data';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';

/**
 * POST /api/framework-scoring — the anonymous benchmark contribution.
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * /framework/assess scores a quote the visitor received, very often from a
 * competitor, and AssessClient.tsx says in its own header that the answers are
 * never sent anywhere — because the moment a scoring tool posts silently it
 * becomes a lead-capture form wearing a tool's clothes, and the honest answer
 * to "should I trust this scoring?" becomes no. That decision stands. This
 * route does not weaken it; it exists because there is a second, different
 * thing a person may choose to do with a result they already have.
 *
 * The contribution is:
 *   · opt-in, unticked by default, below a result that renders in full to
 *     everyone who ignores it;
 *   · complete scorings only — a partial answer set would bias the benchmark
 *     toward whichever criteria people answer first;
 *   · twenty-seven characters, a version string and an optional municipality.
 *     No name, no email, no user, no IP, no note. The table has no column for
 *     any of them.
 *
 * WHY THE BUSINESS WANTS IT. Nobody in this trade can currently say how often
 * a GTA hardwood quote specifies a moisture test, because nobody has ever
 * counted. With enough contributions Ecowoods can publish exactly that — a
 * sentence about the market rather than about itself, sourced to a dataset it
 * owns, which is the kind of claim an answer engine cites and a competitor
 * cannot answer. It is also the only asset here that gets better because
 * somebody ELSE received a bad quote.
 *
 * WHAT IT MUST NEVER BECOME. A path to a lead. There is no email field, and
 * adding one is not a feature request — it is the end of the dataset's
 * credibility and of its publishability at the same time.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DECODE: Record<string, Answer> = { y: 'yes', u: 'unsure', n: 'no' };

/** Municipality names only, matched against the published service areas. */
function normaliseRegion(input: string | undefined): string | null {
  if (!input) return null;
  const wanted = input.trim().toLowerCase();
  const hit = CITIES.find((c) => c.name.toLowerCase() === wanted);
  return hit ? hit.name : null;
}

export async function POST(request: Request) {
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ ok: false, message: 'Origin not allowed.' }, { status: 403 });
  }

  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Please wait a moment before sending another contribution.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Send JSON.' }, { status: 400 });
  }

  const parsed = frameworkScoringSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'That contribution did not validate.' }, { status: 400 });
  }

  const { frameworkVersion, answers, region } = parsed.data;

  /* A scoring against another version of the instrument is not comparable to
     one against this version, and silently pooling them would corrupt the
     benchmark in a way no later query could detect. Refuse rather than
     coerce. */
  if (frameworkVersion !== FRAMEWORK_VERSION) {
    return NextResponse.json(
      { ok: false, message: 'That score was made against a different version of the framework.' },
      { status: 409 },
    );
  }

  if (answers.length !== criterionCount()) {
    return NextResponse.json({ ok: false, message: 'That score does not match this framework.' }, { status: 400 });
  }

  /* Complete scorings only. An answer set with gaps tells us more about which
     criteria are easy to answer than about the quotes being scored. */
  if (answers.includes('-')) {
    return NextResponse.json(
      { ok: false, message: 'Only a complete scoring can be contributed.' },
      { status: 400 },
    );
  }

  /* The score is recomputed here from the answers, never trusted from the
     client. The browser sends what it observed; the server decides what it
     means, using the same lib/framework.ts the page rendered from. */
  const criteria = allCriteria();
  const decoded: Record<string, Answer> = {};
  criteria.forEach((c, i) => {
    const a = DECODE[answers[i]!];
    if (a) decoded[c.id] = a;
  });
  const result = score(decoded);

  /* The consent row carries no subject, because there is no subject to name.
     It is still written: it records that the wording shown said what it said,
     on which surface, at which version — which is what makes the claim "this
     dataset was contributed knowingly" checkable rather than asserted. */
  try {
    await grantConsent({ purpose: 'BENCHMARK_CONTRIBUTION', surface: 'framework-assess' });
  } catch {
    /* Non-fatal. A missing ledger row is a reporting gap; refusing the
       contribution over it would lose the data point AND the consent. */
  }

  const stored = await recordFrameworkScoring({
    frameworkVersion,
    answers,
    score: result.pct,
    verdict: result.verdict,
    criticalFailures: result.failedCritical.length,
    region: normaliseRegion(region),
  });

  if (!stored.ok) {
    return NextResponse.json({ ok: false, message: 'Could not record that just now.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: 'Added to the benchmark. Thank you.' }, { status: 201 });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message:
        'POST a completed framework scoring to contribute it anonymously. There is deliberately no read endpoint: the benchmark is published as findings on /framework, not as a queryable surface, until the corpus is large enough that an aggregate cannot single anybody out.',
    },
    { status: 405 },
  );
}
