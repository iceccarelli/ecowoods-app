import type { Metadata } from 'next';
import Link from 'next/link';
import AssessClient from './AssessClient';
import { FRAMEWORK_VERSION, criterionCount } from '@/lib/framework';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

export const metadata: Metadata = {
  title: `Score a hardwood quote — Well-Installed Framework v${FRAMEWORK_VERSION} | EcoWoods`,
  description:
    'Score any hardwood flooring quote against 27 published criteria across six pillars. Runs entirely in your browser — nothing is sent anywhere. Works on any contractor, including us.',
  alternates: { canonical: '/framework/assess' },
  openGraph: {
    title: 'Score a hardwood flooring quote',
    description:
      'A free self-assessment against a published, versioned framework. Nothing is submitted or stored.',
    type: 'website',
    url: `${SITE_URL}/framework/assess`,
  },
};

export default function AssessPage() {
  return (
    <div className="tlx-page">
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Framework', url: `${SITE_URL}/framework` },
          { name: 'Self-assessment', url: `${SITE_URL}/framework/assess` },
        ])}
      />

      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
            <Link href="/framework">Framework</Link> <span aria-hidden="true">/</span>{' '}
            <span>Self-assessment</span>
          </nav>
          <h1 className="tlx-title">Score a quote</h1>
          <p className="tlx-lede">
            {criterionCount()} questions across six pillars, drawn from the technical papers on this
            site. Answer them against the quote in front of you — ours or anyone else&rsquo;s — and
            the result tells you which questions to go back and ask in writing.
          </p>
          <p className="fw-privacy">
            Nothing here is sent anywhere. No submission, no account, no stored answers, no tracking
            of what you enter. The result is printed by your browser. That is deliberate: a tool for
            scoring someone else&rsquo;s quote is only worth using if it is not also a lead form.
          </p>
        </div>
      </header>

      <AssessClient />
    </div>
  );
}
