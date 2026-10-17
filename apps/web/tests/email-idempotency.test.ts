/** sendEmail hands an idempotency key to Resend as an option, never in the payload; SMTP/dev ignore it. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: 'e1' }, error: null });
  vi.resetModules();
  process.env.RESEND_API_KEY = 're_test';
});

describe('sendEmail idempotencyKey', () => {
  it('passes the key as the Resend request option and leaves the payload untouched', async () => {
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>', text: 'x', idempotencyKey: 'report-delivery/o1/v1' });
    expect(send).toHaveBeenCalledTimes(1);
    const [payload, options] = send.mock.calls[0]!;
    expect(options).toEqual({ idempotencyKey: 'report-delivery/o1/v1' });
    expect(payload).not.toHaveProperty('idempotencyKey');
    expect(payload).toMatchObject({ to: 'a@example.com', subject: 's' });
  });

  it('sends no options when no key is given (existing callers unchanged)', async () => {
    const { sendEmail } = await import('@/lib/email');
    await sendEmail({ to: 'a@example.com', subject: 's', html: '<p>x</p>' });
    expect(send.mock.calls[0]![1]).toBeUndefined();
  });

  it('still throws on a Resend error so callers can keep the failure visible', async () => {
    send.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { sendEmail } = await import('@/lib/email');
    await expect(sendEmail({ to: 'a@example.com', subject: 's', html: 'x', idempotencyKey: 'k' })).rejects.toThrow(/boom/);
  });
});
