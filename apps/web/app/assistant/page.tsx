import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { WORKSPACE_ASSISTANT } from '@/lib/assistant-workspace/identity';
import { loadCaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario-evidence';
import { WorkspaceShell } from './components/WorkspaceShell';

export const metadata: Metadata = {
  title: `${WORKSPACE_ASSISTANT.name} — plan your hardwood project`,
  description:
    'A project workspace, not a chatbot: talk through your hardwood project with Francisco Oller and get the products and services that fit, a cost range from our published bands, and a clear next step. Nothing invented — every number traces to a published price.',
  alternates: { canonical: '/assistant' },
  openGraph: {
    title: WORKSPACE_ASSISTANT.name,
    description:
      'Plan a hardwood project with Ecowoods: products, services, a real cost range, and a next step — never an invented number.',
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
 * history.
 *
 * A separate product from the corner Quick Assistant (EcowoodsGuide). The
 * corner widget is a chat transcript mounted on every page; this is a
 * dedicated workspace built around a project's decision state — the floor,
 * the services, the cost range, the evidence — with conversation as one way
 * to work on that state, not the whole of it.
 *
 * The shell (ASSISTANT-01) is now stateful: a canonical, typed
 * WorkspaceState (lib/assistant-workspace) drives all three zones and the
 * mobile bar, minted a designId and persists anonymously in localStorage.
 * Still no economics engine beyond published-band pricing, no value
 * scenario, no Floor Studio bridge, no booking, no live model call — see
 * docs/assistant-workspace/PHASE_PLAN.md. This rename is chrome/identity
 * only; it does not claim capability (renovation-economics, market/appraisal
 * analysis, other trades) that does not exist yet.
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
            Plan a hardwood project with me: the floor, the services, a cost range from our published bands, and
            a next step — not a chat window that forgets what you told it.
          </p>
        </div>
      </header>

      <WorkspaceShell evidencePool={evidencePool} />
    </div>
  );
}
