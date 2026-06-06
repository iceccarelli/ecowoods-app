'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, getSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import SocialLoginButtons from '@/app/components/SocialLoginButtons';
import type { OAuthProvider } from '@/lib/auth-providers';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginForm({ enabledProviders }: { enabledProviders: OAuthProvider[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid email or password. Please try again.');
        return;
      }

      toast.success('Welcome back!');
      // If there's an explicit callbackUrl, use it; otherwise route by role
      if (callbackUrl) {
        router.push(callbackUrl);
      } else {
        const session = await getSession();
        router.push(session?.user?.role === 'ADMIN' ? '/admin' : '/mypage');
      }
      router.refresh();
    } catch (err) {
      console.error('[login] error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <span className="brand-mark" style={{ width: 44, height: 44 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 2C9 6 6 8 6 12c0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3-6-6-10Z" fill="currentColor" fillOpacity="0.18" />
              <path d="M12 4.5c-2 3-4 4.5-4 7.5 0 2.5 1.8 4.5 4 4.5" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>Ecowoods</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Customer Portal</div>
          </div>
        </div>

        <h1 className="auth-title">Sign in to your account</h1>
        <p className="auth-sub">Access your quotes, projects, and invoices.</p>

        {/* Social login */}
        {enabledProviders.length > 0 && (
          <>
            <SocialLoginButtons enabledProviders={enabledProviders} callbackUrl={callbackUrl ?? '/mypage'} mode="login" />
            <div className="auth-or-divider"><span>or sign in with email</span></div>
          </>
        )}

        {/* Email form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-form">
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={errors.email ? 'field-error' : ''}
              {...register('email')}
            />
            {errors.email && <p className="error-message">{errors.email.message}</p>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className={errors.password ? 'field-error' : ''}
              {...register('password')}
            />
            {errors.password && <p className="error-message">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            className="btn btn-copper btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link href="/register">Create one — it&apos;s free</Link>
        </p>

        {/* Demo credentials (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <div className="auth-divider"><span>Demo credentials</span></div>
            <div className="auth-demo-creds">
              <p><strong>Customer:</strong> sarah.miller@gmail.com / Customer2026!</p>
              <p><strong>Admin:</strong> admin@ecowoods.ca / Admin2026!</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
