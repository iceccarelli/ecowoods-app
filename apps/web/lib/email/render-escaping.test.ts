import { beforeAll, describe, expect, it, vi } from 'vitest';

/* Render every HTML email builder through the real sendEmail → Resend path (client
   mocked) with hostile input in every customer-controlled field, and assert the
   markup that arrives is inert. */
const sent: { subject: string; html: string }[] = [];
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async (m: { subject: string; html: string }) => (sent.push(m), { error: null }) };
  },
}));

const EVIL = `<script>alert(1)</script><img src=x onerror=alert(2)>"'`;
const ESCAPED_MARK = '&lt;script&gt;';
let mail: typeof import('./index');

beforeAll(async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  mail = await import('./index');
});

async function last(fn: () => Promise<unknown>) {
  sent.length = 0;
  await fn();
  expect(sent).toHaveLength(1);
  return sent[0].html;
}

function expectInert(html: string) {
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/<img/i);
  expect(html).not.toContain('onerror=alert(2)>');
  expect(html).toContain(ESCAPED_MARK);
}

describe('rendered email bodies neutralise hostile input', () => {
  it('reviewRequestEmail (greeting + project title)', () => {
    const { html } = mail.reviewRequestEmail({ name: EVIL, projectTitle: EVIL });
    expectInert(html);
  });
  it('welcome', async () => expectInert(await last(() => mail.sendWelcomeEmail({ to: 'a@b.ca', name: EVIL, linkedQuotesCount: 1 }))));
  it('invoice', async () =>
    expectInert(await last(() => mail.sendInvoiceEmail({ to: 'a@b.ca', name: EVIL, invoiceNumber: EVIL, invoiceId: 'i1', total: 10, projectTitle: EVIL }))));
  it('admin photo triage', async () =>
    expectInert(await last(() => mail.sendAdminPhotoTriageEmail({ leadId: 'l', name: EVIL, email: EVIL, phone: EVIL, area: EVIL, intent: EVIL, sqft: 1, designSummary: EVIL, attachments: [] }))));
  it('admin new quote', async () =>
    expectInert(await last(() => mail.sendAdminNewQuoteEmail({ quoteId: 'q', name: EVIL, email: EVIL, phone: EVIL, city: EVIL, province: EVIL, species: [EVIL], service: EVIL, notes: EVIL }))));
  it('admin new inquiry', async () =>
    expectInert(await last(() => mail.sendAdminNewInquiryEmail({ inquiryId: 'i', name: EVIL, email: EVIL, subject: EVIL, message: EVIL }))));
  it('inquiry reply', async () =>
    expectInert(await last(() => mail.sendInquiryReplyEmail({ to: 'a@b.ca', name: EVIL, subject: EVIL, replyContent: EVIL, inquiryId: 'i' }))));
  it('contract', async () =>
    expectInert(await last(() => mail.sendContractEmail({ to: 'a@b.ca', name: EVIL, projectTitle: EVIL, contractPdfUrl: 'https://ecowoods.ca/c.pdf', portalProjectUrl: 'https://ecowoods.ca/p' }))));
  it('appointment confirmation', async () =>
    expectInert(await last(() => mail.sendAppointmentConfirmationEmail({ to: 'a@b.ca', name: EVIL, whenLabel: EVIL, durationMinutes: 60, service: EVIL }))));
  it('quote received', async () => expectInert(await last(() => mail.sendQuoteReceivedEmail({ name: EVIL, email: 'a@b.ca', leadId: EVIL }))));
  it('admin pilot lead', async () =>
    expectInert(await last(() => mail.sendAdminNewPilotLeadEmail({ pilotLeadId: 'p', name: EVIL, email: EVIL, phone: EVIL, company: EVIL, role: EVIL, message: EVIL, program: EVIL }))));
  it('keeps newlines as <br> after escaping', async () => {
    const html = await last(() => mail.sendAdminNewInquiryEmail({ inquiryId: 'i', name: 'n', email: 'e', subject: 's', message: 'a\nb<i>' }));
    expect(html).toContain('a<br>b&lt;i&gt;');
  });
});
