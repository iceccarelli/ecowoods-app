import HomePage from './home-client';
import { ContentLibraryPromo } from './components/ContentLibraryPromo';

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
  return <HomePage contentPromo={<ContentLibraryPromo />} />;
}
