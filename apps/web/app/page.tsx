import type { Metadata } from 'next';
import HomePage from './home-client';
import { ContentLibraryPromo } from './components/ContentLibraryPromo';
import { CommercialHeadTermRail } from './components/CommercialHeadTermRail';

/**
 * The homepage is the one route whose canonical genuinely is '/'. It used to get
 * that by inheriting the root layout — and so did every other page, which is the
 * bug (F-142). Declared here explicitly so removing it from the layout costs the
 * homepage nothing, and so verify-canonical.mjs can see it.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};


/**
 * Server entry for the homepage.
 *
 * The homepage UI lives in home-client.tsx (a client component — scroll
 * reveals, sliders, etc.). ContentLibraryPromo is an async server component
 * that reads .mdx files from disk, so it must be rendered here on the server
 * and passed down as a prop; importing it directly from a client component
 * bundles `fs` for the browser and breaks the build.
 */
export default function Page() {
  /* The rail rides in on the same slot as the library promo. home-client.tsx
     is a client component and CommercialHeadTermRail reads server-only
     manifests, so it is composed here and passed down — the same reason
     ContentLibraryPromo is a prop rather than an import. See F-80. */
  return (
    <HomePage
      contentPromo={
        <>
          <CommercialHeadTermRail />
          <ContentLibraryPromo />
        </>
      }
    />
  );
}
