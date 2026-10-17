/**
 * Customer document intake decides file type from the BYTES. Real route
 * handlers for the three affected routes (free Quote Review, paid
 * Well-Installed Quote Review, paid Listing Floor Report); only Prisma, the
 * email sender, Floor Graph and photo storage are faked, so "rejected" is
 * proven as "nothing was emailed, stored, retained or written".
 *
 * Byte sniffing verifies a file-type signature. It does not make a PDF or an
 * image harmless to every parser.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sniffDocument } from '@/lib/image-sniff';

type Order = { id: string; status: string; notes: string | null; user: { email: string } };

const s = vi.hoisted(() => ({
  order: null as null | Order,
  emails: [] as Array<{ attachments?: Array<{ filename: string; content: Buffer }> }>,
  orderUpdates: [] as unknown[],
  assessments: 0,
  consents: 0,
  stored: 0,
  retained: 0,
  events: [] as string[],
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: async () => (s.order ? { ...s.order } : null),
      update: async (a: unknown) => void s.orderUpdates.push(a),
      // The intake claim and release are not "consuming" the order; only the FULFILLED write is.
      updateMany: async (a: { data: { status?: string } }) => {
        if (a.data.status === 'FULFILLED') s.orderUpdates.push(a);
        return { count: 1 };
      },
    },
  },
}));
vi.mock('@/lib/email', () => ({ sendEmail: async (m: { attachments?: [] }) => void s.emails.push(m) }));
vi.mock('@/lib/quote-intelligence/events', () => ({ recordQuoteReviewEvent: (name: string) => void s.events.push(name) }));
vi.mock('@/lib/floor-graph', () => ({
  recordAssessment: async () => (s.assessments++, { ok: true, value: 'assessment-1' }),
  storeAssessmentPhotos: async (_a: string, _c: string, photos: unknown[]) => (s.retained += photos.length, { ok: true, value: photos.length }),
}));
vi.mock('@/lib/floor-graph/consent', async (orig) => ({
  ...(await orig<typeof import('@/lib/floor-graph/consent')>()),
  grantConsent: async () => (s.consents++, 'consent-1'),
}));
vi.mock('@/lib/floor-graph/photo-storage', () => ({
  storePhoto: async () => (s.stored++, { ok: true, url: 'https://blob.test/p' }),
}));

const quoteReview = await import('@/app/api/quote-review/route');
const wellInstalled = await import('@/app/api/well-installed-review/submit/route');
const listing = await import('@/app/api/listing-floor-report/submit/route');

const enc = (t: string) => new TextEncoder().encode(t);
const pad = (head: Uint8Array, n = 64) => Uint8Array.from([...head, ...new Array(Math.max(0, n - head.length)).fill(0)]);

const BYTES = {
  jpeg: pad(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])),
  png: pad(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: pad(enc('RIFF\0\0\0\0WEBPVP8 ')),
  heic: pad(enc('\0\0\0\x18ftypheic')),
  heif: pad(enc('\0\0\0\x18ftypmif1')),
  pdf: pad(enc('%PDF-1.7\n1 0 obj\n')),
  html: enc('<html><script>alert(1)</script></html>'),
  htmlAsPdf: enc('<!doctype html><p>%PDF-1.7</p>'),
  random: Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) & 0xff),
  truncatedPdf: enc('%PDF'),
  truncatedJpeg: Uint8Array.from([0xff, 0xd8]),
};
const IP = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
const OID = '11111111-1111-4111-8111-111111111111';

type Upload = { bytes: Uint8Array; type: string; name?: string };
const file = (u: Upload) => new File([u.bytes], u.name ?? 'upload.bin', { type: u.type });
const req = (url: string, form: FormData) =>
  new Request(`http://localhost${url}`, { method: 'POST', body: form, headers: { 'x-forwarded-for': IP() } });

const sendQuoteReview = (uploads: Upload[]) => {
  const f = new FormData();
  f.set('name', 'Jane Homeowner');
  f.set('email', 'jane@example.com');
  for (const u of uploads) f.append('documents', file(u));
  return quoteReview.POST(req('/api/quote-review', f));
};
const sendWellInstalled = (uploads: Upload[]) => {
  s.order = { id: OID, status: 'PAID', notes: 'Well-Installed Quote Review (Standard)', user: { email: 'jane@example.com' } };
  const f = new FormData();
  f.set('orderId', OID);
  f.set('email', 'jane@example.com');
  for (const u of uploads) f.append('documents', file(u));
  return wellInstalled.POST(req('/api/well-installed-review/submit', f));
};
const sendListing = (uploads: Upload[], photoConsent = true) => {
  s.order = { id: OID, status: 'PAID', notes: 'Listing Floor Report (photo)', user: { email: 'jane@example.com' } };
  const f = new FormData();
  for (const [k, v] of Object.entries({ orderId: OID, email: 'jane@example.com', role: 'agent', address: '12 Example St', city: 'Toronto', photographyDate: '2026-11-01' })) f.set(k, v);
  if (photoConsent) f.set('photoConsent', 'on');
  for (const u of uploads) f.append('photos', file(u));
  return listing.POST(req('/api/listing-floor-report/submit', f));
};

beforeEach(() => {
  s.order = null;
  s.emails.length = 0;
  s.orderUpdates.length = 0;
  s.events.length = 0;
  s.assessments = s.consents = s.stored = s.retained = 0;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('sniffDocument', () => {
  it('recognises JPEG, PNG, WebP, HEIC, HEIF and PDF', () => {
    expect(sniffDocument(BYTES.jpeg)).toEqual({ contentType: 'image/jpeg', ext: 'jpg' });
    expect(sniffDocument(BYTES.png)?.contentType).toBe('image/png');
    expect(sniffDocument(BYTES.webp)?.contentType).toBe('image/webp');
    expect(sniffDocument(BYTES.heic)?.ext).toBe('heic');
    expect(sniffDocument(BYTES.heif)?.ext).toBe('heic');
    expect(sniffDocument(BYTES.pdf)).toEqual({ contentType: 'application/pdf', ext: 'pdf' });
  });
  it('rejects HTML, a PDF signature that is not at offset 0, random bytes, and truncated or empty content', () => {
    for (const bad of [BYTES.html, BYTES.htmlAsPdf, BYTES.random, BYTES.truncatedPdf, BYTES.truncatedJpeg, new Uint8Array([]), enc('%PDF-x.y')]) {
      expect(sniffDocument(bad)).toBeNull();
    }
  });
});

const REJECTED: Array<[string, Upload]> = [
  ['HTML claiming image/jpeg', { bytes: BYTES.html, type: 'image/jpeg', name: 'q.jpg' }],
  ['HTML claiming application/pdf', { bytes: BYTES.htmlAsPdf, type: 'application/pdf', name: 'q.pdf' }],
  ['arbitrary bytes named .pdf with no declared type', { bytes: BYTES.random, type: '', name: 'q.pdf' }],
  ['arbitrary bytes with no declared type', { bytes: BYTES.random, type: '' }],
  ['a truncated PDF', { bytes: BYTES.truncatedPdf, type: 'application/pdf' }],
  ['a truncated JPEG', { bytes: BYTES.truncatedJpeg, type: 'image/jpeg' }],
];

describe('free Quote Review (/api/quote-review)', () => {
  it.each(REJECTED)('rejects %s: 400, nothing emailed', async (_n, bad) => {
    const res = await sendQuoteReview([{ bytes: BYTES.pdf, type: 'application/pdf', name: 'ok.pdf' }, bad]);
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.documents).toMatch(/PDF or an image/);
    expect(s.emails).toHaveLength(0);
  });

  it.each([
    ['jpeg', 'image/jpeg', 'jpg'], ['png', 'image/png', 'png'], ['webp', 'image/webp', 'webp'],
    ['heic', 'image/heic', 'heic'], ['heif', 'image/heif', 'heic'], ['pdf', 'application/pdf', 'pdf'],
  ] as const)('accepts a genuine %s and names the attachment from the verified type', async (kind, type, ext) => {
    const res = await sendQuoteReview([{ bytes: BYTES[kind], type, name: '../../my "quote"\r\n.bin' }]);
    expect(res.status).toBe(201);
    expect(s.emails).toHaveLength(1);
    expect(s.emails[0]!.attachments![0]!.filename).toBe(`my-quote.${ext}`);
  });

  it('accepts a genuine file with missing MIME metadata, normalised from its bytes', async () => {
    expect((await sendQuoteReview([{ bytes: BYTES.pdf, type: '', name: 'quote' }])).status).toBe(201);
    expect(s.emails[0]!.attachments![0]!.filename).toBe('quote.pdf');
  });

  it('a declared type that conflicts with real bytes cannot change how the file is treated', async () => {
    expect((await sendQuoteReview([{ bytes: BYTES.png, type: 'application/pdf', name: 'q.pdf' }])).status).toBe(201);
    expect(s.emails[0]!.attachments![0]!.filename).toBe('q.png');
  });

  it('size limits follow the verified type: an image cannot use the PDF 8 MB allowance by claiming PDF', async () => {
    const big = new Uint8Array(3 * 1024 * 1024);
    big.set(BYTES.jpeg);
    const res = await sendQuoteReview([{ bytes: big, type: 'application/pdf', name: 'q.pdf' }]);
    expect(res.status).toBe(400);
    expect(s.emails).toHaveLength(0);
    const bigPdf = new Uint8Array(3 * 1024 * 1024);
    bigPdf.set(BYTES.pdf);
    expect((await sendQuoteReview([{ bytes: bigPdf, type: 'application/pdf', name: 'q.pdf' }])).status).toBe(201);
  });

  it('still limits the file count to 3', async () => {
    const one = { bytes: BYTES.pdf, type: 'application/pdf' };
    expect((await sendQuoteReview([one, one, one, one])).status).toBe(400);
    expect(s.emails).toHaveLength(0);
  });
});

describe('paid Well-Installed Quote Review (/api/well-installed-review/submit)', () => {
  it.each(REJECTED)('rejects %s: no email, order unchanged, no documents-received event', async (_n, bad) => {
    const res = await sendWellInstalled([bad]);
    expect(res.status).toBe(400);
    expect(s.emails).toHaveLength(0);
    expect(s.orderUpdates).toHaveLength(0);
    expect(s.events).not.toContain('well_installed_review.documents_received');
  });

  it('a rejected upload does not consume the order: the corrected resubmission succeeds', async () => {
    expect((await sendWellInstalled([{ bytes: BYTES.html, type: 'application/pdf' }])).status).toBe(400);
    expect((await sendWellInstalled([{ bytes: BYTES.pdf, type: '' }])).status).toBe(201);
    expect(s.emails).toHaveLength(1);
    expect(s.emails[0]!.attachments![0]!.filename).toBe('upload.pdf');
    expect(s.orderUpdates).toHaveLength(1);
    expect(s.events).toContain('well_installed_review.documents_received');
  });

  it('keeps the product binding: a PAID listing-report order is still a 404 with valid bytes', async () => {
    const f = new FormData();
    f.set('orderId', OID);
    f.set('email', 'jane@example.com');
    f.append('documents', file({ bytes: BYTES.pdf, type: 'application/pdf' }));
    s.order = { id: OID, status: 'PAID', notes: 'Listing Floor Report (photo)', user: { email: 'jane@example.com' } };
    expect((await wellInstalled.POST(req('/api/well-installed-review/submit', f))).status).toBe(404);
    expect(s.emails).toHaveLength(0);
  });
});

describe('paid Listing Floor Report (/api/listing-floor-report/submit)', () => {
  const photos = (extra: Upload): Upload[] => [
    { bytes: BYTES.jpeg, type: 'image/jpeg', name: 'a.jpg' },
    { bytes: BYTES.png, type: 'image/png', name: 'b.png' },
    extra,
  ];

  it.each([...REJECTED, ['a PDF (images only on this route)', { bytes: BYTES.pdf, type: 'image/jpeg', name: 'p.jpg' } as Upload]] as Array<[string, Upload]>)(
    'rejects %s before any Floor Graph write, retention, email or order change',
    async (_n, bad) => {
      const res = await sendListing(photos(bad));
      expect(res.status).toBe(400);
      expect(s.assessments).toBe(0);
      expect(s.consents).toBe(0);
      expect(s.stored).toBe(0);
      expect(s.retained).toBe(0);
      expect(s.emails).toHaveLength(0);
      expect(s.orderUpdates).toHaveLength(0);
    },
  );

  it('accepts genuine JPEG/PNG/WebP/HEIC/HEIF (with a missing MIME), retains with the verified type and names attachments from it', async () => {
    const res = await sendListing([
      { bytes: BYTES.jpeg, type: '', name: 'a' },
      { bytes: BYTES.webp, type: 'image/webp', name: 'b.jpg' },
      { bytes: BYTES.heif, type: 'image/heif', name: '../c.heif' },
      { bytes: BYTES.heic, type: 'image/heic', name: 'd.heic' },
      { bytes: BYTES.png, type: 'image/png', name: 'e.png' },
    ]);
    expect(res.status).toBe(201);
    expect(s.emails[0]!.attachments!.map((a) => a.filename)).toEqual(['a.jpg', 'b.webp', 'c.heic', 'd.heic', 'e.png']);
    expect(s.stored).toBe(5);
    expect(s.retained).toBe(5);
    expect(s.orderUpdates).toHaveLength(1);
  });

  it('still enforces the 3-photo minimum, 8-photo maximum and its own product identity', async () => {
    expect((await sendListing([{ bytes: BYTES.jpeg, type: 'image/jpeg' }])).status).toBe(400);
    const one = { bytes: BYTES.jpeg, type: 'image/jpeg' };
    expect((await sendListing(new Array(9).fill(one))).status).toBe(400);
    expect(s.emails).toHaveLength(0);
    s.order = { id: OID, status: 'PAID', notes: 'Well-Installed Quote Review (Standard)', user: { email: 'jane@example.com' } };
    const f = new FormData();
    for (const [k, v] of Object.entries({ orderId: OID, email: 'jane@example.com', role: 'agent', address: '12 Example St', city: 'Toronto', photographyDate: '2026-11-01' })) f.set(k, v);
    for (let i = 0; i < 3; i++) f.append('photos', file(one));
    expect((await listing.POST(req('/api/listing-floor-report/submit', f))).status).toBe(404);
    expect(s.emails).toHaveLength(0);
  });
});
