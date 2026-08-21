import type { Metadata } from 'next';
import Link from 'next/link';
import ConfiguratorSection from '../components/ConfiguratorSection';

export const metadata: Metadata = {
  title: 'Design Your Floor',
  description:
    'Pick species, finish, pattern, and size — and see a live installed-price range built from the same numbers our estimator carries in the truck. Toronto & GTA.',
  alternates: { canonical: 'https://ecowoods.ca/design' },
  openGraph: {
    title: 'Design Your Floor — EcoWoods',
    description:
      'Configure your hardwood floor and see a live installed-price range. A range, not a quote — the fixed price is written after we measure your subfloor.',
    type: 'website',
    url: 'https://ecowoods.ca/design',
  },
};

export default function DesignPage() {
  return (
    <div className="tlx-page">
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
            in-home measure — or hands your exact configuration to RenoGuide. No retyping.
          </p>
        </div>
      </header>
      <ConfiguratorSection />
    </div>
  );
}
