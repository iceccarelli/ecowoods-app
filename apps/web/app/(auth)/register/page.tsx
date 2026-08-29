/**
 * 회원가입 페이지 — 서버 컴포넌트 (wrapper)
 */
import type { Metadata } from 'next';
import { getEnabledProviders } from '@/lib/auth-providers';
import RegisterForm from './RegisterForm';

export const dynamic = 'force-dynamic';

/** Same fix as /login (P0-6): own title, explicit noindex. */
export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  const enabledProviders = getEnabledProviders();
  return <RegisterForm enabledProviders={enabledProviders} />;
}
