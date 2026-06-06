'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import SocialLoginButtons from '@/app/components/SocialLoginButtons';
import { registerUser } from '@/lib/actions/auth';
import type { OAuthProvider } from '@/lib/auth-providers';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type RegisterData = z.infer<typeof registerSchema>;

type Step = 'form' | 'check-email';

export default function RegisterForm({ enabledProviders }: { enabledProviders: OAuthProvider[] }) {
  const [step, setStep] = useState<Step>('form');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const result = await registerUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Registration failed. Please try again.');
        return;
      }

      setSubmittedEmail(data.email);
      if (result.devVerifyUrl) setDevVerifyUrl(result.devVerifyUrl);
      setStep('check-email');
    } catch (err) {
      console.error('[register] error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: "Check your email" screen ────────────────────────────────────
  if (step === 'check-email') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub">
            We sent a verification link to <strong>{submittedEmail}</strong>.
            Click the link in the email to activate your account.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
            The link expires in 30 minutes. Check your spam folder if you don&apos;t see it.
          </p>

          {/* Dev mode shortcut — shown when RESEND is not configured */}
          {devVerifyUrl && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#fef9c3',
              border: '1px solid #fbbf24',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}>
              <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                🛠 Dev mode — no email service configured
              </p>
              <p style={{ color: '#78350f', marginBottom: '0.75rem' }}>
                Click the link below to verify directly (also visible in your terminal):
              </p>
              <a
                href={devVerifyUrl}
                className="btn btn-copper btn-sm"
                style={{ display: 'inline-block', wordBreak: 'break-all' }}
              >
                Verify my account →
              </a>
            </div>
          )}

          <p className="auth-footer" style={{ marginTop: '2rem' }}>
            Already verified? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 1: Registration form ─────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
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
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Create your account</div>
          </div>
        </div>

        <h1 className="auth-title">Create a free account</h1>
        <p className="auth-sub">
          Track quotes, download contracts, and pay invoices online.
          Previous quote requests with this email will be linked automatically.
        </p>

        {enabledProviders.length > 0 && (
          <>
            <SocialLoginButtons enabledProviders={enabledProviders} callbackUrl="/mypage" mode="register" />
            <div className="auth-or-divider"><span>or sign up with email</span></div>
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-form">
          <div className="field-row">
            <div className="field">
              <label htmlFor="name">Full name *</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                className={errors.name ? 'field-error' : ''}
                {...register('name')}
              />
              {errors.name && <p className="error-message">{errors.name.message}</p>}
            </div>
            <div className="field">
              <label htmlFor="phone">
                Phone <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span>
              </label>
              <input id="phone" type="tel" autoComplete="tel" placeholder="(416) 555-0123" {...register('phone')} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email address *</label>
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

          <div className="field-row">
            <div className="field">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className={errors.password ? 'field-error' : ''}
                {...register('password')}
              />
              {errors.password && <p className="error-message">{errors.password.message}</p>}
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password *</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                className={errors.confirmPassword ? 'field-error' : ''}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && <p className="error-message">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-copper btn-lg"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? 'Sending verification email…' : 'Create account'}
          </button>

          <p className="form-disclosure" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
            By creating an account you agree to our{' '}
            <Link href="/privacy">Privacy Policy</Link>{' '}and{' '}
            <Link href="/terms">Terms of Service</Link>.
          </p>
        </form>

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
