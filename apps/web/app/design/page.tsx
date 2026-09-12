import type { Metadata } from 'next';
import Link from 'next/link';
import ConfiguratorSection from '../components/ConfiguratorSection';
import { NextStep } from '@/app/components/NextStep';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';
import { SITE_URL } from '@/lib/seo-data';

export const metadata: Metadata = {
  title: 'Design Your Floor',
  description:
    'Pick species, finish, pattern, and size — and see a live installed-price range built from the same numbers our estimator carries in the truck. Toronto & GTA.',
  /* Relative, like every other page on the site — the absolute form was the
     only one in the app and made this page the odd one out. The twin is new in
     UI-NAV-02; Floor Studio has advertised its own since it shipped. */
  alternates: { canonical: '/design', types: { 'text/markdown': '/design.md' } },
  openGraph: {
    title: 'Design Your Floor — Ecowoods',
    description:
      'Configure your hardwood floor and see a live installed-price range. A range, not a quote — the fixed price is written after we measure your subfloor.',
    type: 'website',
    url: 'https://ecowoods.ca/design',
  },
};

export default function DesignPage() {
  return (
    <div className="tlx-page">
      {/* This page carried no structured data at all while its companion
          carried a full breadcrumb. UI-NAV-02. */}
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'Design your floor', url: `${SITE_URL}/design` },
        ])}
      />
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Design Your Floor</span>
          </nav>
          <h1 className="tlx-title">The floor designer</h1>
          <p className="tlx-lede">
            Take your time here. When a combination feels right, one tap books the free
            in-home measure — or hands your exact configuration to EcowoodsGuide. No retyping.
          </p>
          <p className="tlx-lede">
            Want to see it in your own room first?{' '}
            <Link href="/floor-studio">Open Floor Studio</Link> — the same floors, the same
            numbers, rendered into a photo of your space. Two doors, one catalogue: you can
            move between them at any point without losing the floor you picked.
          </p>
        </div>
      </header>
      <ConfiguratorSection />
      <NextStep route="/design" />
    </div>
  );
}
