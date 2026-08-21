import type { MetadataRoute } from 'next';
import icon192 from '../public/icon-192.png';
import icon512 from '../public/icon-512.png';

/**
 * PWA / Android / Google manifest. The 192 and 512 icons are the EW monogram
 * on cream with maskable-safe padding, so Android home-screen and Google
 * surfaces render the brand mark without cropping it. theme/background colors
 * match the brand tokens (--walnut-950 chrome, --cream-50 splash).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ecowoods — Toronto Hardwood Flooring',
    short_name: 'Ecowoods',
    description:
      'Installation, refinishing & restoration of solid and engineered hardwood in Toronto.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf6ef',
    theme_color: '#1a0f08',
    /**
     * Bundled URLs, not public/ paths.
     *
     * These pointed at /icon-192.png and /icon-512.png, which have returned 404
     * for as long as they have existed — apps/web/public is not served on this
     * host (F-131). Every Android home-screen install and every Google surface
     * that read this manifest fetched two dead URLs and rendered no brand mark.
     *
     * A static import resolves to the hashed _next/static path, the one
     * mechanism proven to work here.
     */
    icons: [
      { src: icon192.src, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512.src, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon192.src, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon512.src, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
