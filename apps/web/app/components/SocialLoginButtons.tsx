'use client';

/**
 * SocialLoginButtons — Google, Facebook, Apple OAuth 로그인 버튼
 *
 * 어떤 provider가 환경변수에 설정되어 있는지 서버에서 prop으로 받아
 * 활성화된 버튼만 렌더링합니다.
 *
 * 사용 예시:
 *   <SocialLoginButtons
 *     callbackUrl="/mypage"
 *     enabledProviders={['google', 'facebook', 'apple']}
 *   />
 */

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';

type Provider = 'google' | 'facebook' | 'apple';

const PROVIDER_CONFIG: Record<Provider, { label: string; icon: React.ReactNode; style: React.CSSProperties }> = {
  google: {
    label: 'Continue with Google',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
        <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.615 24 12.255 24z" />
        <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
        <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.64 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
      </svg>
    ),
    style: {
      background: '#ffffff',
      color: '#3c4043',
      border: '1px solid #dadce0',
    },
  },
  facebook: {
    label: 'Continue with Facebook',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    style: {
      background: '#1877F2',
      color: '#ffffff',
      border: '1px solid #1877F2',
    },
  },
  apple: {
    label: 'Continue with Apple',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
    style: {
      background: '#000000',
      color: '#ffffff',
      border: '1px solid #000000',
    },
  },
};

interface SocialLoginButtonsProps {
  callbackUrl?: string;
  enabledProviders: Provider[];
  mode?: 'login' | 'register'; // label만 달라짐
}

export default function SocialLoginButtons({
  callbackUrl = '/mypage',
  enabledProviders,
  mode = 'login',
}: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  if (enabledProviders.length === 0) return null;

  const handleSocialLogin = async (provider: Provider) => {
    setLoadingProvider(provider);
    try {
      await signIn(provider, { callbackUrl });
      // 리디렉션이 발생하므로 아래 코드는 실행되지 않음
    } catch {
      toast.error('소셜 로그인에 실패했습니다. 다시 시도해 주세요.');
      setLoadingProvider(null);
    }
  };

  const labelPrefix = mode === 'register' ? '가입' : '로그인';

  return (
    <div className="social-login-buttons">
      {enabledProviders.map((provider) => {
        const config = PROVIDER_CONFIG[provider];
        const isLoading = loadingProvider === provider;

        return (
          <button
            key={provider}
            type="button"
            onClick={() => handleSocialLogin(provider)}
            disabled={loadingProvider !== null}
            className="social-btn"
            style={config.style}
            aria-label={`${config.label}으로 ${labelPrefix}`}
          >
            <span className="social-btn-icon" aria-hidden="true">
              {isLoading ? <LoadingSpinner /> : config.icon}
            </span>
            <span>{isLoading ? '로그인 중…' : config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: 'spin 0.8s linear infinite' }}
      aria-hidden="true"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
