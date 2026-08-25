import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-data';
import { buildBreadcrumbList } from '@/lib/schema/builders';
import { SchemaScript } from '@/lib/schema/components';

/* ──────────────────── METADATA ────────────────────
   Lives here (Server Component) because page.tsx is a
   Client Component — Next.js forbids exporting `metadata`
   from a module marked "use client".
   ────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'FloorForge — Autonomous Floor Refinishing Pilot',
  alternates: { canonical: '/products/floorforge' },
  description:
    'FloorForge is an early-access autonomous floor refinishing robot in the software + hardware alignment stage. Open to contractor pilots in 2026. Join the interest list.',
  openGraph: {
    title: 'FloorForge — Autonomous Floor Refinishing Pilot',
    description:
      'Autonomous floor sanding and finishing. Early-access pilot for contractors. In active development.',
    type: 'website',
  },
};

/**
 * The breadcrumb lives here for the same reason the metadata does: page.tsx is
 * a client component and cannot emit either.
 *
 * `pnpm seo:density` found this as the only deep page on the site with no
 * BreadcrumbList. Two segments from the root, no declared parent — so Google
 * had nothing to display in the result and nowhere to attribute the page, on
 * the one URL that is not about hardwood flooring at all. A product page
 * floating unparented next to a local-services entity is exactly the kind of
 * ambiguity that dilutes an entity graph.
 */
export default function FloorForgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SchemaScript
        schema={buildBreadcrumbList([
          { name: 'Home', url: SITE_URL },
          { name: 'FloorForge', url: `${SITE_URL}/products/floorforge` },
        ])}
      />
      {children}
    </>
  );
}
