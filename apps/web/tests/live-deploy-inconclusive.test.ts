import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const script = path.resolve(__dirname, '../../../scripts/verify-live-deploy.mjs');

describe('verify-live-deploy — an unreachable site is never green', () => {
  it('exits 2 (inconclusive), not 0, when nothing answers', () => {
    const r = spawnSync(process.execPath, [script, '--base', 'http://127.0.0.1:9', '--expect', 'HEAD'], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('INCONCLUSIVE');
    expect(r.stderr).toContain('[unreachable]');
    expect(r.stdout).not.toContain('live deploy verified');
  });
});
