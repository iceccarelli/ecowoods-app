/**
 * /verify-email?token=xxx
 * Verifies the email token, creates the user account, then auto-signs in.
 */
import Link from 'next/link';
import { verifyEmailToken } from '@/lib/actions/auth';
import VerifyEmailClient from './VerifyEmailClient';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h1 className="auth-title">Invalid link</h1>
          <p className="auth-sub">This verification link is missing a token.</p>
          <Link href="/register" className="btn btn-copper btn-sm" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
            Register again
          </Link>
        </div>
      </div>
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
          <h1 className="auth-title">Link expired or invalid</h1>
          <p className="auth-sub">{result.error}</p>
          <Link href="/register" className="btn btn-copper btn-sm" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
            Register again
          </Link>
        </div>
      </div>
    );
  }

  // Success — auto-sign-in happens on the client side
  return (
    <VerifyEmailClient
      email={result.email!}
      linkedQuotesCount={result.linkedQuotesCount ?? 0}
    />
  );
}
