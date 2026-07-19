import type { MetadataRoute } from 'next';

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
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
