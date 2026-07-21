/**
 * Email service — supports Resend API or SMTP (nodemailer).
 *
 * Priority:
 *   1. RESEND_API_KEY set   → use Resend (recommended for production)
 *   2. SMTP_HOST set        → use SMTP / nodemailer (Gmail, etc.)
 *   3. Neither              → dev mode (log to console, no email sent)
 *
 * ── Resend setup ──────────────────────────────────────────────────────────
 *   1. Sign up at resend.com (free: 3,000 emails/month)
 *   2. Dev testing: use onboarding@resend.dev as FROM (no domain needed)
 *   3. Production: verify your domain → add SPF/DKIM DNS records
 *   RESEND_API_KEY=re_xxxxxxxxxx
 *   RESEND_FROM_EMAIL=onboarding@resend.dev   ← works immediately, no domain
 *
 * ── Gmail SMTP setup ───────────────────────────────────────────────────────
 *   1. Google Account → Security → 2-Step Verification (must be ON)
 *   2. Google Account → Security → App Passwords → create one
 *      (select "Mail" + "Other", name it "Ecowoods")
 *   3. Copy the 16-character app password
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your.gmail@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx    ← 16-char app password (spaces OK)
 *   SMTP_FROM=your.gmail@gmail.com
 */

import { Resend } from 'resend';

// ── Transport selection ────────────────────────────────────────────────────────

function getTransport(): 'resend' | 'smtp' | 'dev' {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST)      return 'smtp';
  return 'dev';
}

const transport = getTransport();

// Resend client (lazy — only initialized when needed)
const resend = transport === 'resend'
  ? new Resend(process.env.RESEND_API_KEY!)
  : null;

const FROM =
  process.env.RESEND_FROM_EMAIL ??
  process.env.SMTP_FROM ??
  'hello@ecowoods.ca';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@ecowoods.ca';

// ── Core sendEmail function ───────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  // ── Dev mode — log to console, no real email ────────────────────────────
  if (transport === 'dev') {
    console.log('\n[email] DEV MODE — would send:');
    console.log(`  To:      ${to}`);
    console.log(`  Subject: ${subject}`);
    if (text) console.log(`  Body:    ${text.slice(0, 200)}`);
    console.log();
    return;
  }

  // ── Resend ──────────────────────────────────────────────────────────────
  if (transport === 'resend' && resend) {
    const result = await resend.emails.send({
      from: `Ecowoods <${FROM}>`,
      to,
      subject,
      html,
      text,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
    return;
  }

  // ── SMTP (nodemailer) ───────────────────────────────────────────────────
  if (transport === 'smtp') {
    // Lazy import — nodemailer is an optional dep (pnpm add nodemailer @types/nodemailer)
    let nodemailer: typeof import('nodemailer');
    try {
      nodemailer = await import('nodemailer');
    } catch {
      throw new Error('nodemailer is not installed. Run: pnpm add nodemailer --filter @ecowoods/web');
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_PORT === '465', // true for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `Ecowoods <${FROM}>`,
      to,
      subject,
      html,
      text,
    });
  }
}

// ─── Welcome email ─────────────────────────────────────────────────────────────
export async function sendWelcomeEmail({
  to,
  name,
  linkedQuotesCount,
}: {
  to: string;
  name: string;
  linkedQuotesCount: number;
}) {
  const linkedMsg = linkedQuotesCount > 0
    ? `<p style="background:#f5efe6;padding:12px 16px;border-left:3px solid #c87e4f;border-radius:4px;">
        🌲 We found <strong>${linkedQuotesCount} previous quote request${linkedQuotesCount > 1 ? 's' : ''}</strong> submitted with your email address and linked ${linkedQuotesCount > 1 ? 'them' : 'it'} to your account. You can view ${linkedQuotesCount > 1 ? 'them' : 'it'} in My Quotes.
       </p>`
    : '';

  await sendEmail({
    to,
    subject: 'Welcome to Ecowoods — your account is ready',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a0f08;">
        <div style="background:#1a0f08;padding:24px 32px;text-align:center;">
          <h1 style="color:#fdfbf6;margin:0;font-size:20px;font-weight:300;letter-spacing:2px;">ECOWOODS</h1>
          <p style="color:#c87e4f;margin:4px 0 0;font-size:12px;">TORONTO HARDWOOD FLOORING</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1a0f08;">Welcome, ${name}!</h2>
          <p>Your Ecowoods account has been created. You can now:</p>
          <ul style="line-height:2;">
            <li>Track your quote requests</li>
            <li>View and download contracts</li>
            <li>Pay invoices online (Visa, Mastercard, Apple Pay, Google Pay)</li>
            <li>Communicate with our team</li>
          </ul>
          ${linkedMsg}
          <div style="text-align:center;margin:32px 0;">
            <a href="${process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca'}/mypage"
               style="background:#c87e4f;color:#fdfbf6;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
              View My Account
            </a>
          </div>
          <p style="color:#6b5d52;font-size:13px;">
            Questions? Call (416) 249-1276 or reply to this email.
          </p>
        </div>
        <div style="background:#f5efe6;padding:16px 32px;text-align:center;font-size:12px;color:#6b5d52;">
          Ecowoods Hardwood Flooring Inc. · 32 Norfield Crescent, Toronto, ON M9W 1X6
        </div>
      </div>
    `,
    text: `Welcome to Ecowoods, ${name}!\n\nYour account is ready.\nView your account: ${process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca'}/mypage`,
  });
}

// ─── Invoice email ─────────────────────────────────────────────────────────────
export async function sendInvoiceEmail({
  to,
  name,
  invoiceNumber,
  invoiceId,
  total,
  dueDate,
  projectTitle,
  pdfUrl,
}: {
  to: string;
  name: string;
  invoiceNumber: string;
  invoiceId: string;
  total: number;
  dueDate?: Date;
  projectTitle: string;
  pdfUrl?: string;
}) {
  const totalStr = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(total);
  const dueDateStr = dueDate
    ? `Due: ${new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(dueDate)}`
    : '';

  const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca').replace(/\/$/, '');
  const payUrl = `${baseUrl}/mypage/invoices/${invoiceId}/pay`;
  const viewUrl = `${baseUrl}/docs/invoice/${invoiceId}`;

  await sendEmail({
    to,
    subject: `Invoice #${invoiceNumber} — ${totalStr} — Ecowoods`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a0f08;">
        <div style="background:#1a0f08;padding:24px 32px;text-align:center;">
          <h1 style="color:#fdfbf6;margin:0;font-size:20px;font-weight:300;letter-spacing:2px;">ECOWOODS</h1>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1a0f08;">Invoice Ready — ${invoiceNumber}</h2>
          <p>Hi ${name},</p>
          <p>An invoice has been issued for <strong>${projectTitle}</strong>.</p>
          <div style="background:#f5efe6;padding:16px;border-radius:8px;margin:20px 0;text-align:center;">
            <div style="font-size:13px;color:#6b5d52;">Amount Due</div>
            <div style="font-size:28px;font-weight:700;color:#c87e4f;">${totalStr}</div>
            ${dueDateStr ? `<div style="font-size:13px;color:#6b5d52;margin-top:4px;">${dueDateStr}</div>` : ''}
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${payUrl}" style="background:#c87e4f;color:#fdfbf6;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
              Pay Now — Card / Apple Pay / Google Pay
            </a>
          </div>
          <div style="text-align:center;margin:12px 0 24px;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
            <a href="${viewUrl}" style="color:#1a0f08;font-size:14px;font-weight:600;text-decoration:none;border:1px solid #1a0f08;padding:10px 20px;border-radius:6px;display:inline-block;">
              🔍 View Invoice Online
            </a>
            ${pdfUrl ? `
            <a href="${pdfUrl}" style="color:#6b5d52;font-size:14px;font-weight:600;text-decoration:underline;">
              📄 Download PDF
            </a>` : ''}
          </div>
          <p style="color:#6b5d52;font-size:13px;">
            Prefer to pay by e-transfer? Send to <strong>accounting@ecowoods.ca</strong> with <strong>#${invoiceNumber}</strong> as the memo.<br/>
            Questions? Call (416) 249-1276.
          </p>
        </div>
        <div style="background:#f5efe6;padding:16px 32px;text-align:center;font-size:12px;color:#6b5d52;">
          Ecowoods Hardwood Flooring Inc. · 32 Norfield Crescent, Toronto, ON M9W 1X6
        </div>
      </div>
    `,
    text: `Invoice #${invoiceNumber}\nAmount: ${totalStr}\n${dueDateStr}\n\nView invoice: ${viewUrl}\nPay online: ${payUrl}${pdfUrl ? `\nDownload PDF: ${pdfUrl}` : ''}`,
  });
}

// ─── Admin: new quote notification ────────────────────────────────────────────
export async function sendAdminNewQuoteEmail(data: {
  quoteId: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  province?: string;
  species?: string[];
  squareFeet?: number;
  service?: string;
  notes?: string;
}) {
  const adminUrl = `${process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca'}/admin/quotes/${data.quoteId}`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🌲 New Quote Request — ${data.name} (${data.city ?? 'Unknown'}, ${data.province ?? ''})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;color:#1a0f08;">
        <h2>New Quote Request</h2>
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Name', data.name],
            ['Email', data.email],
            ['Phone', data.phone ?? '—'],
            ['Location', `${data.city ?? '—'}, ${data.province ?? ''}`],
            ['Service', data.service ?? '—'],
            ['Species', data.species?.join(', ') ?? '—'],
            ['Square Footage', data.squareFeet ? `${data.squareFeet.toLocaleString()} sq ft` : '—'],
          ].map(([label, value]) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e8d4b8;font-weight:600;width:40%;color:#6b5d52;">${label}</td>
              <td style="padding:8px;border-bottom:1px solid #e8d4b8;">${value}</td>
            </tr>
          `).join('')}
        </table>
        ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        <a href="${adminUrl}" style="display:inline-block;margin-top:20px;background:#c87e4f;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
          Review in Admin Portal →
        </a>
      </div>
    `,
    text: `New quote from ${data.name} (${data.email}) — ${adminUrl}`,
  });
}

// ─── Admin: new inquiry notification ──────────────────────────────────────────
export async function sendAdminNewInquiryEmail(data: {
  inquiryId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const adminUrl = `${process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca'}/admin/inquiries`;

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `✉ New Inquiry — ${data.subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;color:#1a0f08;">
        <h2>New Inquiry from ${data.name}</h2>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <blockquote style="border-left:3px solid #c87e4f;padding-left:12px;color:#6b5d52;">
          ${data.message.replace(/\n/g, '<br>')}
        </blockquote>
        <a href="${adminUrl}" style="display:inline-block;margin-top:16px;background:#c87e4f;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
          Reply in Admin Portal →
        </a>
      </div>
    `,
    text: `New inquiry from ${data.name}: ${data.subject}\n\n${data.message}\n\nReply: ${adminUrl}`,
  });
}

// ─── Customer: inquiry reply ────────────────────────────────────────────────────
export async function sendInquiryReplyEmail(data: {
  to: string;
  name: string;
  subject: string;
  replyContent: string;
  inquiryId: string;
}) {
  const portalUrl = `${process.env.NEXTAUTH_URL ?? 'https://ecowoods.ca'}/mypage/inquiries`;

  await sendEmail({
    to: data.to,
    subject: `Re: ${data.subject} — Ecowoods`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;color:#1a0f08;">
        <div style="background:#1a0f08;padding:20px 32px;">
          <h2 style="color:#fdfbf6;margin:0;font-size:18px;font-weight:300;">ECOWOODS</h2>
        </div>
        <div style="padding:32px;">
          <p>Hi ${data.name},</p>
          <p>Our team has replied to your inquiry: <strong>${data.subject}</strong></p>
          <div style="background:#f5efe6;padding:16px;border-left:3px solid #c87e4f;margin:20px 0;border-radius:4px;white-space:pre-wrap;line-height:1.7;">
            ${data.replyContent.replace(/\n/g, '<br>')}
          </div>
          <a href="${portalUrl}" style="display:inline-block;background:#c87e4f;color:#fdfbf6;padding:12px 24px;text-decoration:none;border-radius:6px;">
            View Full Conversation
          </a>
          <p style="color:#6b5d52;font-size:13px;margin-top:24px;">
            Ecowoods Hardwood Flooring Inc. · (416) 249-1276
          </p>
        </div>
      </div>
    `,
    text: `Reply from Ecowoods:\n\n${data.replyContent}\n\nView: ${portalUrl}`,
  });
}

// ─── Customer: contract ready ───────────────────────────────────────────────────
export async function sendContractEmail({
  to,
  name,
  projectTitle,
  contractPdfUrl,
  portalProjectUrl,
  viewUrl,
}: {
  to: string;
  name: string;
  projectTitle: string;
  contractPdfUrl: string;
  portalProjectUrl: string;
  viewUrl?: string;
}) {
  await sendEmail({
    to,
    subject: `Your Ecowoods Contract is Ready — ${projectTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1a0f08;">
        <div style="background:#1a0f08;padding:24px 32px;text-align:center;">
          <h1 style="color:#fdfbf6;margin:0;font-size:20px;font-weight:300;letter-spacing:2px;">ECOWOODS</h1>
          <p style="color:#c87e4f;margin:4px 0 0;font-size:12px;">TORONTO HARDWOOD FLOORING</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1a0f08;margin-top:0;">Your Contract is Ready, ${name}</h2>
          <p>We're excited to move forward with your project. Please review and sign the contract at your earliest convenience.</p>
          <div style="background:#faf6ef;padding:16px 20px;border-left:3px solid #c87e4f;border-radius:4px;margin:24px 0;">
            <div style="font-size:12px;color:#6b5d52;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Project</div>
            <div style="font-size:16px;font-weight:700;">${projectTitle}</div>
          </div>
          ${viewUrl ? `
          <div style="text-align:center;margin:28px 0 12px;">
            <a href="${viewUrl}"
               style="background:#c87e4f;color:#fdfbf6;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:600;display:inline-block;">
              🔍 View Contract Online
            </a>
          </div>` : ''}
          <div style="text-align:center;margin:${viewUrl ? '0' : '28px 0'} 0 16px;">
            <a href="${contractPdfUrl}"
               style="color:#6b5d52;font-size:13px;font-weight:600;text-decoration:underline;">
              📄 Download PDF directly
            </a>
          </div>
          <div style="text-align:center;margin:16px 0 28px;">
            <a href="${portalProjectUrl}"
               style="color:#c87e4f;font-size:13px;font-weight:600;text-decoration:underline;">
              View in My Account
            </a>
          </div>
          <p style="color:#6b5d52;font-size:13px;line-height:1.7;">
            Please print, sign, and return the contract — or reach out to us and we can arrange an e-signature.<br/>
            Questions? Call <strong>(416) 249-1276</strong> or reply to this email.
          </p>
        </div>
        <div style="background:#f5efe6;padding:16px 32px;text-align:center;font-size:12px;color:#6b5d52;">
          Ecowoods Hardwood Flooring Inc. · 32 Norfield Crescent, Toronto, ON M9W 1X6
        </div>
      </div>
    `,
    text: `Hi ${name},\n\nYour contract for "${projectTitle}" is ready.\n\n${viewUrl ? `View online: ${viewUrl}\n` : ''}Download PDF: ${contractPdfUrl}\nView in portal: ${portalProjectUrl}\n\nQuestions? Call (416) 249-1276.\n\nEcowoods Hardwood Flooring Inc.`,
  });
}


// ─── Customer: in-home estimate confirmation ─────────────────────────────────
export async function sendAppointmentConfirmationEmail(data: {
  to: string;
  name: string;
  whenLabel: string;     // e.g. "Thursday, June 18, 2026 at 2:00 PM"
  durationMinutes: number;
  service?: string;
}) {
  await sendEmail({
    to: data.to,
    subject: `Your Ecowoods in-home estimate — ${data.whenLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;color:#1a0f08;">
        <h2 style="color:#1a0f08;">Your estimate is confirmed</h2>
        <p>Hi ${data.name}, thanks for booking a free in-home estimate with Ecowoods.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;border-bottom:1px solid #e8d4b8;font-weight:600;width:40%;color:#6b5d52;">When</td><td style="padding:8px;border-bottom:1px solid #e8d4b8;">${data.whenLabel}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e8d4b8;font-weight:600;color:#6b5d52;">Duration</td><td style="padding:8px;border-bottom:1px solid #e8d4b8;">${data.durationMinutes} minutes</td></tr>
          ${data.service ? `<tr><td style="padding:8px;border-bottom:1px solid #e8d4b8;font-weight:600;color:#6b5d52;">Service</td><td style="padding:8px;border-bottom:1px solid #e8d4b8;">${data.service}</td></tr>` : ''}
        </table>
        <p>A senior estimator will arrive on time with species and finish samples. Need to change it? Just call <a href="tel:+14162491276">(416) 249-1276</a>.</p>
        <p style="color:#6b5d52;font-size:13px;">Ecowoods Hardwood Flooring · 32 Norfield Crescent, Toronto</p>
      </div>
    `,
    text: `Your Ecowoods in-home estimate is confirmed for ${data.whenLabel} (${data.durationMinutes} min). Questions? Call (416) 249-1276.`,
  });
}
