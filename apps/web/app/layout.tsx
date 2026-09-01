import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import Header from './components/Header';
import { UtilityBar } from './components/UtilityBar';
import './globals.css';
import Providers from './providers';
import { THEME_NO_FLASH_SCRIPT } from '@/lib/theme';
import { ROOT_ORGANIZATION_SCHEMA, ROOT_WEBSITE_SCHEMA } from '@/lib/schema';
import ConversionRail from './components/ConversionRail';
import ReadingProgress from './components/ReadingProgress';

/* ---------------------- Fonts ---------------------- */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  style: ['normal', 'italic'],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

import SiteFooter from "./components/SiteFooter";

/* ---------------------- Root Layout ---------------------- */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Colours the mobile browser chrome to match the showroom, per theme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfbf6' },
    { media: '(prefers-color-scheme: dark)', color: '#12100d' },
  ],
};

import ChatWidgetLoader from "./components/ChatWidgetLoader";
import CookieConsentBanner from './components/CookieConsentBanner';
import TelClickTracker from './components/TelClickTracker';
import { HOME_TITLE, HOME_DESCRIPTION } from '@/lib/alpha-keywords';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';
const DESCRIPTION = HOME_DESCRIPTION;

const VERIFICATION = {
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : {}),
  ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
    ? { other: { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
    : {}),
};

export const metadata: Metadata = {
  // Was pinned to the vercel.app preview host, so every canonical, og:url and
  // og:image resolved to a domain the business does not use.
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: '%s · Ecowoods',
  },
  description: DESCRIPTION,
  applicationName: 'Ecowoods',
  // The RSS autodiscovery link. Feed readers, aggregators and several answer
  // engines look for exactly this element and nothing else; a feed that is not
  // declared here is a feed only someone who already knows the URL can find.
  // NO `canonical` HERE. Next merges metadata from the root layout down into
  // every page, and a page that does not declare its own `alternates.canonical`
  // INHERITS this object wholesale. This block used to carry `canonical: '/'`,
  // which meant /technical-library, /blog, /case-studies and /products/floorforge
  // each served <link rel="canonical" href="https://ecowoods.ca"> — telling every
  // crawler that they are duplicates of the homepage and should not be indexed.
  // The sitemap offered 101 URLs; roughly one was indexed. See F-142.
  //
  // The RSS autodiscovery link stays, because it is genuinely site-wide: it points
  // at the same feed from every page, which is what a feed reader expects.
  // Canonicals are not site-wide by nature. Each route declares its own, and
  // scripts/verify-canonical.mjs fails the build if a sitemapped route does not.
  alternates: {
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: 'Ecowoods — Technical Publications' }] },
  },
  // NO `keywords`. Google published "Google does not use the keywords meta tag
  // in web ranking" in 2009 and has never revised it; Bing gives it ~nothing and
  // has said a stuffed one reads as a spam signal. The five that used to sit
  // here were bytes shipped to every visitor for no effect. The phrases they
  // were reaching for now live in lib/alpha-keywords.ts and do their work in the
  // title, the H1 and the anchor text, where they are actually read.
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: SITE_URL,
    siteName: 'Ecowoods',
    title: HOME_TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: true, address: true },
  verification: VERIFICATION,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-CA"
      className={`${fraunces.variable} ${jakarta.variable} ${mono.variable}`}
      // The no-flash script writes data-theme before React hydrates. Without
      // this, React would "correct" the DOM back to light and flash.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint. Must stay the first thing in <head>. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_NO_FLASH_SCRIPT }} />

        {/*
          Root entity graph: Organization → Services + Website + FAQ.
          Injected on every page. Every article/case study/product references
          these via @id pointers, creating a deeply nested, machine-readable
          entity graph that AI agents can ingest and cite.

          Schema coverage on EVERY route:
          - LocalBusiness (+ 6 nested Services)
          - WebSite
          - Note: AggregateRating kept separate per schema.org compliance

          FAQPage is deliberately NOT here. It used to be, which declared all 67
          routes — /admin, /mypage/invoices, /blog/*, /docs/quote/[id] — as FAQ
          pages, and gave the homepage a SECOND FAQPage on top of the one
          home-client.tsx already renders. Google's FAQPage guidance requires the
          FAQ to be the page's main content. The homepage and the 16
          service-area pages emit their own, next to the visible questions.
          See audit/FINDINGS.md F-27.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ROOT_ORGANIZATION_SCHEMA) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ROOT_WEBSITE_SCHEMA) }}
        />

        {/* Unsplash serves the hero + gallery. Warm the connection early. */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body id="top">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>
          <ReadingProgress />
          {/* ONE CHROME BLOCK, IN FLOW.
              .topbar was position:fixed at top:0, so it painted directly over
              the UtilityBar sitting in flow underneath it — measured: the ub
              occupied y 0–39 and the fixed header y 0–65, so the utility strip
              was invisible and the first 26px of every page was under the
              header. When the header hid on scroll, the strip appeared from
              nowhere, which is the "double header in the wrong place".
              Sticky keeps the pair in flow, so they reserve their own height —
              no spacer, no height arithmetic to drift — and still pin on
              scroll. See .site-chrome in globals.css. */}
          <div className="site-chrome">
            <UtilityBar />
            <Header />
          </div>
          <main id="main">{children}</main>
          <SiteFooter />
          <ChatWidgetLoader />
          <ConversionRail />
          {/* P0.5 — the consent banner was written, wired to GA/Pixel, cited by
              the privacy page and the footer button… and never mounted. So no
              consent was ever collected and analytics never loaded on any
              visit. It renders here, once, site-wide. TelClickTracker is the
              delegated tel_click listener (renders nothing). */}
          <CookieConsentBanner />
          <TelClickTracker />
        </Providers>
      </body>
    </html>
  );
}
