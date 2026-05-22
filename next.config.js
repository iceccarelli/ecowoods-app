/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Images: page.tsx currently uses plain <img> tags pointing at Unsplash,
  // but if you migrate to next/image these remote patterns let it work.
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ecowoods.ca' },
      { protocol: 'https', hostname: 'cdn.ecowoods.ca' },
    ],
  },

  // Sensible production headers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // Optional: proxy /api/* on the same origin to the FastAPI backend that
  // Vercel mounts at /_/backend. This means the frontend can call /api/leads
  // and the backend's /api/leads handler will respond — no CORS, no env vars
  // required in the browser.
  //
  // Comment this block out if your backend exposes routes WITHOUT an /api
  // prefix, or if you prefer to call /_/backend/* directly from the client.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/_/backend/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
