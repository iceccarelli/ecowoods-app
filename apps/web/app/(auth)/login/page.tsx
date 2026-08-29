import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getEnabledProviders } from '@/lib/auth-providers';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

/**
 * P0-6. This page had no metadata at all, so it served the HOMEPAGE title with
 * the site-wide `X-Robots-Tag: index, follow` (vercel.json) — while robots.txt
 * disallows /login. Three surfaces, three answers. A sign-in form is not a
 * search result: it gets its own title and an explicit noindex, and vercel.json
 * now sends the matching X-Robots-Tag header for this route.
 */
export const metadata: Metadata = {
  title: 'Client sign in',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const enabledProviders = getEnabledProviders();
  return (
    <Suspense>
      <LoginForm enabledProviders={enabledProviders} />
    </Suspense>
  );
}
