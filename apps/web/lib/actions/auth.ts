'use server';

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signOut } from '@/lib/auth';
import { addMinutes } from 'date-fns';

// ─── Registration (step 1) ────────────────────────────────────────────────────
// Stores a pending token and sends a verification email.
// The user account is NOT created until they click the link.

interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

interface RegisterResult {
  success: boolean;
  error?: string;
  /** In development (no RESEND) the verification URL is returned directly */
  devVerifyUrl?: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { name, email, phone, password } = input;

  // Reject if a verified account already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.emailVerified) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Delete any previous unverified tokens for this email
  await db.emailVerificationToken.deleteMany({ where: { email } });

  const record = await db.emailVerificationToken.create({
    data: {
      email,
      name,
      phone: phone ?? null,
      passwordHash,
      expiresAt: addMinutes(new Date(), 30), // 30-minute window
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${record.token}`;

  // Send verification email
  const emailSent = await sendVerificationEmail({ to: email, name, verifyUrl });

  if (!emailSent) {
    // Dev mode: return the URL directly so the developer can test without email
    return { success: true, devVerifyUrl: verifyUrl };
  }

  return { success: true };
}

async function sendVerificationEmail({
  to,
  name,
  verifyUrl,
}: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    // No email service → log to console (dev mode fallback)
    console.log('\n[auth] EMAIL VERIFICATION (no RESEND configured)');
    console.log(`  To:  ${to}`);
    console.log(`  URL: ${verifyUrl}\n`);
    return false; // indicates dev mode
  }

  try {
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({
      to,
      subject: 'Verify your Ecowoods account',
      html: `
        <div style="font-family:sans-serif;max-width:500px;color:#1a0f08;">
          <div style="background:#1a0f08;padding:20px 32px;text-align:center;">
            <h1 style="color:#fdfbf6;margin:0;font-size:18px;font-weight:300;letter-spacing:2px;">ECOWOODS</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-bottom:0.5rem;">Hi ${name},</h2>
            <p>Click the button below to verify your email and activate your account.</p>
            <p style="color:#6b5d52;font-size:13px;">This link expires in 30 minutes.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${verifyUrl}"
                 style="background:#c87e4f;color:#fdfbf6;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
                Verify my email
              </a>
            </div>
            <p style="font-size:12px;color:#9a8a7a;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error('[auth] verification email failed:', e);
    return false;
  }
}

// ─── Email verification (step 2) ────────────────────────────────────────────
// Called when user clicks the link in their email (or dev URL).
// Creates the real User record and cleans up the token.

export async function verifyEmailToken(token: string): Promise<{
  success: boolean;
  error?: string;
  email?: string;
  linkedQuotesCount?: number;
}> {
  const record = await db.emailVerificationToken.findUnique({ where: { token } });

  if (!record) return { success: false, error: 'Invalid or already used verification link.' };
  if (record.expiresAt < new Date()) {
    await db.emailVerificationToken.delete({ where: { token } });
    return { success: false, error: 'This verification link has expired. Please register again.' };
  }

  // Double-check no verified account exists (race condition guard)
  const existing = await db.user.findUnique({ where: { email: record.email } });
  if (existing?.emailVerified) {
    await db.emailVerificationToken.delete({ where: { token } });
    return { success: true, email: record.email, linkedQuotesCount: 0 }; // already verified
  }

  // Create the user account
  const user = await db.user.upsert({
    where: { email: record.email },
    update: {
      name: record.name,
      phone: record.phone,
      passwordHash: record.passwordHash,
      emailVerified: true,
    },
    create: {
      email: record.email,
      name: record.name,
      phone: record.phone,
      passwordHash: record.passwordHash,
      emailVerified: true,
    },
  });

  // Link any orphan quote requests
  const { count: linkedQuotesCount } = await db.quoteRequest.updateMany({
    where: { email: record.email, userId: null },
    data: { userId: user.id },
  });

  // Clean up token
  await db.emailVerificationToken.delete({ where: { token } });

  // Send welcome email (non-blocking)
  import('@/lib/email').then(({ sendWelcomeEmail }) => {
    sendWelcomeEmail({ to: user.email, name: user.name ?? user.email, linkedQuotesCount })
      .catch((e) => console.error('[email] welcome send failed:', e));
  });

  return { success: true, email: record.email, linkedQuotesCount };
}

// ─── Sign out ────────────────────────────────────────────────────────────────
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
