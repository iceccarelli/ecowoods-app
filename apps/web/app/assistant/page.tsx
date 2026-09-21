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
 * /assistant — AI Home Advisor. ASSISTANT-01: shell only.
 *
 * A separate product from the corner Quick Assistant (EcowoodsGuide). The
 * corner widget is a chat transcript mounted on every page; this is a
 * dedicated workspace built around a project's decision state — the floor,
 * the services, the cost range, the evidence — with conversation as one way
 * to work on that state, not the whole of it.
 *
 * This phase ships the shell only: layout, identity, reachability. No
 * economics, no value scenario, no Floor Studio bridge, no booking, no live
 * model calls. See docs/assistant-workspace/PHASE_PLAN.md for what comes
 * after and why it isn't here yet.
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
