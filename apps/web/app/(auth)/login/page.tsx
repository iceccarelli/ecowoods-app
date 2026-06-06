/**
 * 로그인 페이지 — 서버 컴포넌트 (wrapper)
 * Provider 목록을 서버에서 읽어 클라이언트 컴포넌트에 전달합니다.
 */
import { getEnabledProviders } from '@/lib/auth-providers';
import LoginForm from './LoginForm';

export default function LoginPage() {
  const enabledProviders = getEnabledProviders();
  return <LoginForm enabledProviders={enabledProviders} />;
}
