import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const run = (today: string) =>
  spawnSync(process.execPath, ['scripts/verify-claims.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, ECOWOODS_TODAY: today } });

describe('claim registry expiry', () => {
  it('passes before the unsourced deadline with fresh sources', () => {
    expect(run('2026-10-16').status).toBe(0);
  });
  it('fails once unsourced claims outlive UNSOURCED_DEADLINE', () => {
    const r = run('2026-11-05');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('unsourced past the 2026-10-31 deadline');
  });
  it('fails when a verified source has not been re-confirmed for over 400 days', () => {
    const r = run('2028-01-01');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('older than 400 days');
  });
});
