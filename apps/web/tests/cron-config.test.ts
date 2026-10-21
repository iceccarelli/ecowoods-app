/**
 * vercel.json `crons` <-> app/api/cron/** reality check. Vercel invokes crons
 * with GET and `Authorization: Bearer $CRON_SECRET`; a cron whose path has no
 * route 404s silently every run, and a route with no schedule never runs.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const cronDir = path.join(__dirname, '../app/api/cron');
const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
  crons: Array<{ path: string; schedule: string }>;
};
const routeDirs = readdirSync(cronDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const src = (name: string) => readFileSync(path.join(cronDir, name, 'route.ts'), 'utf8');

/** Minimal 5-field cron validation: each field is *, a number, a list, a range or a step within bounds. */
function validCron(expr: string): boolean {
  const bounds = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return false;
  return f.every((field, i) =>
    field.split(',').every((part) => {
      const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part);
      if (!m) return false;
      if (m[2] !== undefined && Number(m[2]) < 1) return false;
      if (m[1] === '*') return true;
      const [lo, hi] = m[1].split('-').map(Number);
      return lo >= bounds[i][0] && (hi ?? lo) <= bounds[i][1] && lo <= (hi ?? lo);
    }),
  );
}

describe('vercel.json crons', () => {
  it('every cron path has a route file, and every cron route has a schedule', () => {
    const scheduled = vercel.crons.map((c) => c.path);
    for (const p of scheduled) {
      expect(p).toMatch(/^\/api\/cron\/[a-z0-9-]+$/);
      expect(existsSync(path.join(cronDir, p.split('/').pop()!, 'route.ts')), `${p} has no route file`).toBe(true);
    }
    expect(new Set(scheduled).size).toBe(scheduled.length);
    expect([...routeDirs].sort()).toEqual(scheduled.map((p) => p.split('/').pop()!).sort());
  });

  it('schedules are valid cron expressions and not more frequent than hourly', () => {
    for (const c of vercel.crons) {
      expect(validCron(c.schedule), `${c.path}: ${c.schedule}`).toBe(true);
      const [minute, hour] = c.schedule.split(/\s+/);
      expect(minute, `${c.path} runs more than once an hour`).toMatch(/^\d+$/);
      expect(hour).not.toMatch(/^\*\/0$/);
    }
  });

  it.each(routeDirs)('%s is GET-only and checks CRON_SECRET before doing any work', (name) => {
    const code = src(name);
    expect(code).toMatch(/export async function GET\(/);
    expect(code).not.toMatch(/export (async )?function (POST|PUT|PATCH|DELETE)\b/);
    const auth = code.indexOf('process.env.CRON_SECRET');
    const gate = code.indexOf("'unauthorized'");
    expect(auth).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(auth);
    // fail-closed when the secret is unset: `!secret ||` must precede the comparison
    expect(code).toMatch(/!secret\s*\|\|/);
    // nothing but the gate sits between the handler's opening and its 401 (no queries/side effects first)
    const body = code.slice(code.indexOf('export async function GET('), gate);
    expect(body).not.toMatch(/\bawait\b|\bdb\./);
    expect(code).toMatch(/export const dynamic = 'force-dynamic'/);
  });

  it.each(routeDirs)('%s refuses anonymous, wrong and unset-secret callers with 401', async (name) => {
    const mod = (await import(`@/app/api/cron/${name}/route`)) as { GET: (r: Request) => Promise<Response> };
    const call = (auth?: string) =>
      mod.GET(new Request(`https://ecowoods.ca/api/cron/${name}`, auth ? { headers: { authorization: auth } } : undefined));
    const prev = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 's3cret-value';
      expect((await call()).status).toBe(401);
      expect((await call('Bearer wrong')).status).toBe(401);
      expect((await call('s3cret-value')).status).toBe(401);
      delete process.env.CRON_SECRET;
      expect((await call('Bearer undefined')).status).toBe(401);
      expect((await call('Bearer ')).status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });
});
