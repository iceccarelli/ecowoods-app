import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';
import { loadCaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario-evidence';
import { NextStep } from '@/app/components/NextStep';
import { WorkspaceShell } from './components/WorkspaceShell';

export const metadata: Metadata = {
  title: `${WORKSPACE_ASSISTANT.name} — home renovation costs and value`,
  description:
    'A renovation decision workspace: talk through whole-home work with Francisco Oller — which renovations move value, which ones only feel good, and what the work actually costs near your house. When hardwood is the next right job, Ecowoods can measure and bid; for other trades, you get sourced market ranges without anyone pretending we install them.',
  alternates: { canonical: '/assistant' },
  openGraph: {
    title: WORKSPACE_ASSISTANT.name,
    description:
      'Home renovation costs and value near your house — with Francisco Oller. Whole-home advising; Ecowoods executes floors and stairs.',
    type: 'website',
    url: `${SITE_URL}/assistant`,
  },
};

/**
 * /assistant — Ask Francisco. ASSISTANT-02: Project Decision State.
 *
 * Same workspace shipped at ASSISTANT-01, renamed to "Ask Francisco" — now
 * voiced as Francisco Oller (owner, professional contractor and lead
 * craftsman — content/claims.ts workforce.francisco) instead of a generic
 * product label. See lib/assistant-workspace/identity.ts for the rename
 * history and the whole-home renovation narrative restore.
 *
 * A separate product from the corner Quick Assistant (EcowoodsGuide). The
 * corner widget is a chat transcript mounted on every page; this is a
 * dedicated workspace built around a project's decision state — the house,
 * the sequence, the cost ranges, the evidence — with conversation as one way
 * to work on that state, not the whole of it.
 *
 * Narrative: Ask Francisco advises on entire home renovations / construction
 * sequencing. Ecowoods commercially performs hardwood installation,
 * refinishing, dust-free sanding, floor restoration, custom inlays/borders,
 * and stair refinishing only — other trades may be discussed with sourced
 * market data; never claimed as Ecowoods installs. Economics adapters for
 * licensed property / market feeds may still be pending_key; public copy
 * stays open to whole-house questions.
 *
 * The shell (ASSISTANT-01) is now stateful: a canonical, typed
 * WorkspaceState (lib/assistant-workspace) drives all three zones and the
 * mobile bar, minted a designId and persists anonymously in localStorage.
 * Still no licensed renovation-economics feeds, no fake AVMs, no Floor
 * Studio bridge inventing tenure or GC status — see
 * docs/assistant-workspace/PHASE_PLAN.md.
 *
 * No ?design= / ?project= URL param yet. A share link is ASSISTANT-08's to
 * build, and building one now — before there's a designCode worth sharing
 * (that arrives with the Floor Studio bridge, ASSISTANT-06) — would be a URL
 * carrying nothing, or a second, premature share-link format this workspace
 * would then have to keep compatible with the real one later.
 *
 * ASSISTANT-05 adds value SCENARIOS (never appraisals) — see
 * docs/assistant-workspace/VALUE_SCENARIO_SPEC.md and
 * lib/assistant-workspace/value-scenario.ts. Case-study evidence is
 * filesystem-backed (`case-study-loader.ts` uses `fs`) and the workspace
 * below this point is all client components, so this Server Component is
 * where that one piece of I/O happens — loaded once, passed down as a plain
 * prop, never re-fetched per render.
 *
 * ASSISTANT-09 adds `<NextStep route="/assistant" />` — required by
 * scripts/verify-strategy.mjs for any route in `lib/funnels`'s
 * `ROUTE_FUNNEL` map, but a deliberate no-op here: the `assistant` funnel's
 * own `nextStep.href` is `/assistant` itself (this workspace already IS the
 * next step for as long as a visitor is in it), so `NextStep` renders
 * nothing — see lib/funnels/index.ts's comment on that entry. The real next
 * step is `ConversionPanel`, rendered inline by `WorkspaceShell` below.
 */
export default async function AssistantPage() {
  const evidencePool = await loadCaseStudyEvidence();

  return (
    <div className="tlx-page aha-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: WORKSPACE_ASSISTANT.name, url: `${SITE_URL}/assistant` },
        ])}
      />
      <header className="tlx-hero aha-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>{WORKSPACE_ASSISTANT.name}</span>
          </nav>
          <p className="tlx-kicker">Project workspace · Ecowoods Inc.</p>
          <h1 className="tlx-title">{WORKSPACE_ASSISTANT.name}</h1>
          <p className="tlx-lede">
            Day job — install, sand and refinish hardwood across Toronto and the GTA.
            Side job — tell homeowners the truth about which renovations move value, which ones only feel good,
            and what the work actually costs near their house.
          </p>
          <p className="tlx-note aha-hero-links">
            Also:{' '}
            <Link href="/estimate">free in-home measure</Link>
            {' · '}
            <Link href="/guides">decision guides</Link>
            {' · '}
            <Link href="/pricing">published price bands</Link>
          </p>
        </div>
      </header>

      <WorkspaceShell evidencePool={evidencePool} />

      <NextStep route="/assistant" />
    </div>
  );
}
