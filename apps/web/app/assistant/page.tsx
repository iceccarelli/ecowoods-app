import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { WorkspaceShell } from './components/WorkspaceShell';

export const metadata: Metadata = {
  title: 'AI Home Advisor — plan your hardwood project',
  description:
    'A project workspace, not a chatbot: talk through your hardwood project and get the products and services that fit, a cost range from our published bands, and a clear next step. Nothing invented — every number traces to a published price.',
  alternates: { canonical: '/assistant' },
  openGraph: {
    title: 'AI Home Advisor',
    description:
      'Plan a hardwood project with Ecowoods: products, services, a real cost range, and a next step — never an invented number.',
    type: 'website',
    url: `${SITE_URL}/assistant`,
  },
};

/**
 * /assistant — AI Home Advisor. ASSISTANT-02: Project Decision State.
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
 * Still no economics engine, no value scenario, no Floor Studio bridge, no
 * booking, no live model call — see docs/assistant-workspace/PHASE_PLAN.md.
 *
 * No ?design= / ?project= URL param yet. A share link is ASSISTANT-08's to
 * build, and building one now — before there's a designCode worth sharing
 * (that arrives with the Floor Studio bridge, ASSISTANT-06) — would be a URL
 * carrying nothing, or a second, premature share-link format this workspace
 * would then have to keep compatible with the real one later.
 */
export default function AssistantPage() {
  return (
    <div className="tlx-page aha-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'AI Home Advisor', url: `${SITE_URL}/assistant` },
        ])}
      />
      <header className="tlx-hero aha-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span> <span>AI Home Advisor</span>
          </nav>
          <p className="tlx-kicker">Project workspace</p>
          <h1 className="tlx-title">AI Home Advisor</h1>
          <p className="tlx-lede">
            Plan a hardwood project here: the floor, the services, a cost range from our published bands, and a
            next step — not a chat window that forgets what you told it.
          </p>
        </div>
      </header>

      <WorkspaceShell />
    </div>
  );
}
