/**
 * 회원가입 페이지 — 서버 컴포넌트 (wrapper)
 */
import { getEnabledProviders } from '@/lib/auth-providers';
import RegisterForm from './RegisterForm';

export default function RegisterPage() {
  const enabledProviders = getEnabledProviders();
  return <RegisterForm enabledProviders={enabledProviders} />;
}
