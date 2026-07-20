import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import Header from './components/Header';
import './globals.css';
import Providers from './providers';
import { THEME_NO_FLASH_SCRIPT } from '@/lib/theme';
import { localBusinessSchema, websiteSchema, faqPageSchema } from '@/lib/structured-data';
import ConversionRail from './components/ConversionRail';
import ReadingProgress from './components/ReadingProgress';

/* ---------------------- Fonts ---------------------- */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '700'],
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';
const DESCRIPTION =
  'Installation, refinishing & restoration of solid and engineered hardwood in Toronto. Dust-free sanding, eco-friendly finishes, manufacturer-backed warranties passed through in writing. Free in-home estimates.';

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
    default: "Ecowoods — Toronto's Master Hardwood Flooring Artisans",
    template: '%s · Ecowoods',
  },
  description: DESCRIPTION,
  applicationName: 'Ecowoods',
  alternates: { canonical: '/' },
  keywords: [
    'hardwood flooring Toronto',
    'floor refinishing Toronto',
    'dust-free sanding GTA',
    'herringbone flooring installation',
    'white oak flooring Toronto',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: SITE_URL,
    siteName: 'Ecowoods',
    title: "Ecowoods — Toronto's Master Hardwood Flooring Artisans",
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: "Ecowoods — Toronto's Master Hardwood Flooring Artisans",
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
          localBusinessSchema has existed in lib/structured-data.ts since the
          repo was written and was never imported by anything. All that SEO
          work was shipping to nobody. It ships now.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema()) }}
        />

        {/* Unsplash serves the hero + gallery. Warm the connection early. */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body id="top">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>
          <ReadingProgress />
          <Header />
          <main role="main" id="main">{children}</main>
          <SiteFooter />
          <ChatWidgetLoader />
          <ConversionRail />
        </Providers>
      </body>
    </html>
  );
}
