import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import Header from './components/Header';
import './globals.css';
import Providers from './providers';

import {
  Instagram,
  Facebook,
  Home,
  Star,
  Linkedin,
  Youtube,
  Twitter,
  MessageCircle,
  Globe,
} from "lucide-react";

import { SOCIAL_LINKS, type SocialLink } from '@ecowoods/shared/constants';

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

/* ---------------------- Icon Map (Single Source of Truth) ---------------------- */

const iconMap: Record<string, React.ComponentType<any>> = {
  Instagram,
  Facebook,
  Houzz: Home,
  Google: Star,
  LinkedIn: Linkedin,
  YouTube: Youtube,
    TikTok: Globe,
  X: Twitter,
  WhatsApp: MessageCircle,
  Website: Globe,
  Telegram: MessageCircle,
};


/* ---------------------- Site Footer ---------------------- */
import SiteFooter from "./components/SiteFooter";

/* ---------------------- Root Layout ---------------------- */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ecowoods-app.vercel.app'),
  title: "Ecowoods — Toronto's Master Hardwood Flooring Artisans",
  description:
    'Installation, refinishing & restoration of solid and engineered hardwood in Toronto. Dust-free sanding, eco-friendly finishes, lifetime workmanship warranty. Free in-home estimates.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={`${fraunces.variable} ${jakarta.variable} ${mono.variable}`}>
      <body id="top">
        <Providers>
          <Header />
          <main role="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
