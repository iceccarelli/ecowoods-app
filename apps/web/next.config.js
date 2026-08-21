/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Force webpack to transpile these packages through SWC.
  // Fixes ChunkLoadError with next-auth v5 beta (ESM/CJS interop issue).
  transpilePackages: ['next-auth', '@auth/core', '@auth/prisma-adapter', 'ai', '@ai-sdk/anthropic', 'zod'],

  // Required for @react-pdf/renderer (uses canvas under the hood)
  serverExternalPackages: ['@react-pdf/renderer'],

  images: {
    // AVIF is best for production but very CPU/RAM-heavy to encode. In a
    // resource-limited dev container, encoding several 2000x2000 images at once
    // makes the optimizer drop some ("received null"). Dev uses cheap WebP;
    // production keeps AVIF for the smaller, higher-quality payload.
    formats: process.env.NODE_ENV === 'development' ? ['image/webp'] : ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'ecowoods.ca' },
      { protocol: 'https', hostname: 'cdn.ecowoods.ca' },
      // Supabase Storage
      { protocol: 'https', hostname: '*.supabase.co' },
      // Vercel Blob
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      // Optional packages that are only used when their env vars are set.
      // Mark as externals so webpack doesn't fail when they aren't installed.
      const optionalExternals = ['@supabase/supabase-js', 'nodemailer'];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, callback) => {
          if (optionalExternals.includes(request)) return callback(null, `commonjs ${request}`);
          callback();
        },
      ];
    }
    return config;
  },

  /**
   * The `.md` companion URLs the llms.txt proposal (v2) asks for:
   *
   *   > pages with information that agents might need provide a clean markdown
   *   > version of those pages at the same URL as the original page, either
   *   > with `.md` appended or with the extension replaced by `.md`
   *
   * App Router cannot express `[slug].md` as a segment — a directory name is
   * either wholly dynamic (`[slug]`) or wholly literal (`llms.txt`), never
   * both. So the handlers live under /md/ and these rewrites put them at the
   * advertised URL.
   *
   * The pattern was checked against the path-to-regexp build that Next ships
   * rather than assumed: `/papers/:slug.md` compiles to
   * `/^\/papers(?:\/([^\/#\?]+?))\.md[\/#\?]?$/i`, so `.md` is stripped from
   * the captured slug and a nested path does not match. Getting that wrong
   * silently would have produced a 404 on every one of these URLs while every
   * guard in the repository passed — which is the shape of the last four
   * findings, so it was tested instead.
   */
  async rewrites() {
    return [
      { source: '/papers/:slug.md', destination: '/md/papers/:slug' },
      { source: '/guides/:slug.md', destination: '/md/guides/:slug' },
      { source: '/glossary/:slug.md', destination: '/md/glossary/:slug' },
    ];
  },

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
};

module.exports = nextConfig;
