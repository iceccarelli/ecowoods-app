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
  /**
   * THE OLD DOMAIN, CONSOLIDATED.
   *
   * ecowoodshardwood.com is the company's earlier domain. Two domains serving
   * the same business split every signal that matters: links point at one,
   * citations at the other, and a search engine resolving the entity has to
   * guess which is canonical. It is the single largest off-page dilution left,
   * and it costs nothing to fix except the decision.
   *
   * Every path maps to the same path on ecowoods.ca with a 301 — permanent,
   * because a 302 tells a crawler to keep the old URL indexed, which is the
   * opposite of consolidation. Path-preserving rather than all-to-homepage: a
   * link to /services/floor-refinishing on the old domain should land on the
   * page about floor refinishing, not on a homepage the visitor then has to
   * navigate. Redirecting everything to / is the most common way this is done
   * and it throws away most of the value.
   *
   * PRECONDITION, and it cannot be satisfied from inside this repository:
   * ecowoodshardwood.com must be added as a domain on this Vercel project so
   * its requests reach this app. Until then these rules match nothing and are
   * inert — they cannot break the live site. Once the domain is attached, the
   * host conditions below fire on the first request.
   *
   * See docs/outreach/DOMAIN_CONSOLIDATION.md.
   */
  /**
   * COMMERCIAL SLUG ALIASES.
   *
   * content/search/route-aliases.json maps every keyword-variant slug this
   * business is asked about — /stairs, /stairs-hardwood, /toronto-flooring,
   * /hardwood-flooring-cost-toronto and thirty-odd others — onto the one page
   * that actually answers that intent.
   *
   * They are redirects rather than pages, and the reasoning is written out at
   * length in content/search/topic-map.ts. The short version: publishing a page
   * per slug is a doorway set under Google's published spam policy, it splits
   * the links and crawl budget one page would concentrate, and a retrieval
   * system deduplicates near-identical documents before it ranks them — so
   * thirty thin variants are one weak citation target, not thirty strong ones.
   * A permanent redirect resolves for anyone who types or links the variant and
   * concentrates every signal on one document.
   *
   * `permanent: true` emits 308. Google treats it identically to 301 for
   * canonicalisation and it preserves the request method, which 301 does not
   * guarantee. scripts/verify-topic-map.mjs fails the build if any destination
   * here is not a real route, or if a key collides with one.
   */
  async redirects() {
    const { aliases } = require('./content/search/route-aliases.json');

    /**
     * THE RULES THAT USED TO BE HERE WERE PATH-PRESERVING, AND THAT WAS THE BUG.
     *
     * They read `/:path*` → `https://ecowoods.ca/:path*` for both old hosts,
     * which is the correct default for almost every domain migration and is
     * exactly wrong for this one. old-domain/path-map.json is the evidence:
     * the two sites share ZERO paths. The old URLs are
     * /pages/flooring-services-toronto-etobicoke-hamilton and
     * /blogs/testimonials/172376--audrey-in-toronto — twenty-two of those
     * testimonials, with real customer names, being the largest stranded
     * reputation asset this business has. Preserving those paths sends every
     * one of them to a hard 404 on ecowoods.ca, which is worse than the state
     * they are in now, because now it is ecowoods.ca serving the dead end.
     *
     * The rules never fired, because the domain has never been attached to this
     * project — so nothing surfaced the defect. Attaching the domain, which is
     * the simplest way to fix the old-domain leak, would have shipped it.
     *
     * They are now generated from the same map that generates .htaccess,
     * nginx.conf and _redirects: `pnpm domain:build`. Requiring the generated
     * file rather than re-deriving it here is the point — the edge layer
     * (vercel.json) and this layer cannot disagree about where an old URL goes,
     * and `pnpm domain:check` fails the build if either drifts from the map.
     */
    const { redirects: oldDomain } = require('../../old-domain/vercel-redirects.json');

    const commercialAliases = Object.entries(aliases).map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));

    /* Old-domain rules first. They are host-conditioned, so they only ever
       match requests that arrive on the retired domain — but a request for
       ecowoodshardwood.com/stairs must be consolidated onto ecowoods.ca before
       anything else looks at the path, or it takes two hops to arrive. */
    return [...oldDomain, ...commercialAliases];
  },

  async rewrites() {
    return [
      { source: '/papers/:slug.md', destination: '/md/papers/:slug' },
      { source: '/guides/:slug.md', destination: '/md/guides/:slug' },
      { source: '/glossary/:slug.md', destination: '/md/glossary/:slug' },
      { source: '/services/:slug.md', destination: '/md/services/:slug' },
      { source: '/service-areas/:slug.md', destination: '/md/service-areas/:slug' },
      /* The entity's own machine edition. Every content collection has had one
         since F-153; the company itself did not until F-187. */
      { source: '/about.md', destination: '/md/about' },
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
          /**
           * CSP, in two headers — now the other way round.
           *
           * P0 shipped a minimal ENFORCED policy and the full policy in
           * REPORT-ONLY, with the instruction: when the console is silent, move
           * the directives across. That has happened, with one change.
           *
           * WHAT MOVED, AND THE ONE THING THAT DID NOT
           *
           * 'unsafe-eval' is GONE and is not coming back. Nothing in this app
           * needs it: there is no eval, no `new Function`, and no library here
           * that compiles templates at runtime. It was inherited from a
           * default. Removing it is most of the value in this header, because
           * eval is the primitive most injected payloads actually want.
           *
           * 'unsafe-inline' STAYS in script-src, and that is a deliberate
           * trade rather than an oversight. Removing it requires a nonce on
           * every inline script, a nonce requires a per-request value, and a
           * per-request value requires rendering every page dynamically. This
           * site prerenders 287 pages and serves them from the CDN with
           * s-maxage; converting all of them to dynamic rendering to tighten
           * one directive would cost the performance work in P2.5 and the
           * caching work in P0.1, in exchange for a policy that Next's own
           * inline bootstrap would then need an exception from anyway.
           *
           * So: enforce everything that is real, keep the one directive whose
           * removal costs more than it buys, and keep a STRICTER report-only
           * header below that omits 'unsafe-inline' — so the console tells us
           * what a future nonce migration would have to cover, measured rather
           * than guessed.
           *
           * The two Meta origins are gone with the pixel (P2.4). connect-src
           * carries only what the code actually calls: GA, the Bank of Canada
           * series behind /market, and IndexNow.
           */
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // No 'unsafe-eval'. See the note above for why 'unsafe-inline' stays.
              "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://www.bankofcanada.ca https://api.indexnow.org",
              // youtube-nocookie is the ProcessVideo facade's iframe (P2.1). It
              // is listed whether or not NEXT_PUBLIC_YOUTUBE_PROCESS_ID is set,
              // because a CSP is static config and a header that has to change
              // when an env var changes is a header somebody will forget.
              "frame-src 'self' https://www.googletagmanager.com https://www.youtube-nocookie.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              'report-uri /api/csp-report',
              "report-to csp",
            ].join('; '),
          },
          {
            // Where `report-to csp` above sends violations. Without this the
            // report-uri directive is the only thing working, and it is
            // deprecated — both are sent because browser support is split.
            key: 'Reporting-Endpoints',
            value: 'csp="/api/csp-report"',
          },
          {
            /* The NEXT rung of the ladder, not a duplicate of the one above.
               This policy is what the enforced header would be after a nonce
               migration: no 'unsafe-inline' anywhere. Violations reported here
               are the exact inventory of inline scripts and styles that
               migration would have to cover. Read the console before starting
               that work rather than estimating it. */
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com",
              "style-src 'self' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://www.bankofcanada.ca https://api.indexnow.org",
              "frame-src 'self' https://www.googletagmanager.com https://www.youtube-nocookie.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              'report-uri /api/csp-report',
            ].join('; '),
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
