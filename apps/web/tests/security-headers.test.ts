import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nextConfig = require('../next.config.js') as {
  headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
};

/**
 * A security policy that contradicts a real product capability is a
 * production defect, not a hardening measure. Floor Studio's live view
 * (/floor-studio#live, LiveRoom.tsx) calls `navigator.mediaDevices.
 * getUserMedia({ video: ... })` for real — the browser enforces Permissions
 * Policy BEFORE that call ever reaches page code, so `camera=()` (an empty
 * allowlist — denied even to this site's own top-level document) silently
 * broke the one feature this header exists to gate. `camera=(self)` is the
 * minimum grant that still allows it: this origin only, never a third-party
 * iframe, never `*`. microphone/geolocation stay denied outright since
 * nothing on this site uses either.
 *
 * next.config.js is the header source Next.js itself serves (verified live
 * against `next start` while fixing this); vercel.json's `headers` block is
 * a second, Vercel-edge copy of the same policy — both must agree or
 * whichever one actually wins in production is undocumented drift.
 */
async function permissionsPolicyForRoot(): Promise<string> {
  const rules = await nextConfig.headers();
  const rootRule = rules.find((r) => r.source === '/(.*)');
  if (!rootRule) throw new Error('next.config.js headers(): no root "/(.*)" rule found');
  const header = rootRule.headers.find((h) => h.key === 'Permissions-Policy');
  if (!header) throw new Error('next.config.js headers(): no Permissions-Policy header on the root rule');
  return header.value;
}

describe('Permissions-Policy: camera must agree with Floor Studio', () => {
  it('next.config.js grants camera to this origin (self), not to no one', async () => {
    const value = await permissionsPolicyForRoot();
    expect(value).toMatch(/camera=\(self\)/);
    expect(value).not.toMatch(/camera=\(\)/);
  });

  it('next.config.js still denies camera to third parties — never a bare wildcard', async () => {
    const value = await permissionsPolicyForRoot();
    expect(value).not.toMatch(/camera=\*/);
    expect(value).not.toContain('camera=(self *)');
  });

  it('microphone and geolocation stay denied — nothing on this site uses either', async () => {
    const value = await permissionsPolicyForRoot();
    expect(value).toMatch(/microphone=\(\)/);
    expect(value).toMatch(/geolocation=\(\)/);
  });

  it('vercel.json carries the identical camera grant as next.config.js — one policy, not two', async () => {
    const nextValue = await permissionsPolicyForRoot();
    const vercelJsonPath = path.resolve(__dirname, '../../../vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8')) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const rootRule = vercelJson.headers.find((r) => r.source === '/(.*)');
    const header = rootRule?.headers.find((h) => h.key === 'Permissions-Policy');
    expect(header?.value).toBeDefined();
    expect(header!.value).toContain('camera=(self)');
    expect(nextValue).toContain('camera=(self)');
  });
});
