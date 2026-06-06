'use client';

/**
 * Client component — handles auto sign-in after email verification.
 * Server verified the token; we just need to sign in via next-auth.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function VerifyEmailClient({
  email,
  linkedQuotesCount,
}: {
  email: string;
  linkedQuotesCount: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'redirecting' | 'done' | 'error'>('redirecting');

  useEffect(() => {
    // Account is verified — redirect to login so the user can sign in with their password.
    // We can't auto-sign-in here because we don't have the plain-text password on the client.
    setStatus('done');
  }, [router, email, linkedQuotesCount]);

  if (status === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 className="auth-title">Sign-in failed</h1>
          <p className="auth-sub">Your account is verified but auto sign-in failed. Please log in manually.</p>
          <Link href="/login" className="btn btn-copper btn-sm" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1 className="auth-title">Email verified!</h1>
        <p className="auth-sub">
          Your account is ready. Sign in with your email and password to access your portal.
        </p>

        {linkedQuotesCount > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.875rem 1rem',
            background: 'rgba(74,124,89,0.08)',
            border: '1px solid rgba(74,124,89,0.25)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9rem',
            color: 'var(--ink)',
          }}>
            🌲 We found <strong>{linkedQuotesCount}</strong> previous quote request{linkedQuotesCount > 1 ? 's' : ''} and linked {linkedQuotesCount > 1 ? 'them' : 'it'} to your account.
          </div>
        )}

        <Link
          href={`/login?callbackUrl=/mypage`}
          className="btn btn-copper btn-lg"
          style={{ marginTop: '1.5rem', display: 'inline-block', width: '100%' }}
        >
          Sign in to your account →
        </Link>
      </div>
    </div>
  );
}
