import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'node_modules' || n === '.next' ? [] : sources(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('email bodies never embed raw customer text', () => {
  it('has no hand-rolled key/value row with an unescaped value cell', () => {
    const offenders = [...sources('app'), ...sources('lib')].filter((f) => /<strong>\$\{v\}<\/strong>/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
