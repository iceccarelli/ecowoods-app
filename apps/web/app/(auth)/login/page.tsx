import { Suspense } from 'react';
import { getEnabledProviders } from '@/lib/auth-providers';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const enabledProviders = getEnabledProviders();
  return (
    <Suspense>
      <LoginForm enabledProviders={enabledProviders} />
    </Suspense>
  );
}
