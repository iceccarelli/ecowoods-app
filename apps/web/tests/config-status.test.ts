/**
 * /admin/system and lib/config-status.ts.
 *
 * Proves: (1) no value, length, prefix or hash of any setting can reach the
 * model or the rendered page; (2) the registry cannot rot in either direction —
 * every registered key is read somewhere, and every process.env read in app/
 * and lib/ is registered or deliberately ignored; (3) the page is admin-only;
 * (4) severity ordering and the red/amber/green summary.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIG_REGISTRY,
  SEVERITY_ORDER,
  countMissingCritical,
  deployFacts,
  evaluateConfig,
  isConfigured,
} from '@/lib/config-status';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: string; email: string } } }));
vi.mock('@/lib/auth', () => ({ auth: async () => session.current }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const webRoot = path.resolve(__dirname, '..');

/** Variables the platform or toolchain sets; not operator configuration. */
const IGNORED = (key: string) => key === 'NODE_ENV' || key === 'NEXT_RUNTIME' || key === 'CI' || key.startsWith('VERCEL_');

function sourceFiles(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|prisma)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && name !== 'config-status.ts') {
        out.push({ file: path.relative(webRoot, full), text: readFileSync(full, 'utf8') });
      }
    }
  };
  for (const d of ['app', 'lib', 'prisma']) walk(path.join(webRoot, d));
  for (const f of ['middleware.ts', 'next.config.js', 'instrumentation.ts']) {
    out.push({ file: f, text: readFileSync(path.join(webRoot, f), 'utf8') });
  }
  return out;
}

describe('registry stays in step with the source', () => {
  const files = sourceFiles();

  it('every registered key is read somewhere in the source', () => {
    for (const { key } of CONFIG_REGISTRY) {
      const re = new RegExp(`\\b${key}\\b`);
      expect(
        files.some((f) => re.test(f.text)),
        `${key} is registered but nothing in app/, lib/, prisma/ or the root config reads it`,
      ).toBe(true);
    }
  });

  it('every process.env read in app/ and lib/ is registered (or ignored)', () => {
    const registered = new Set(CONFIG_REGISTRY.map((c) => c.key));
    const unregistered = new Map<string, string>();
    for (const { file, text } of files) {
      if (!/^(app|lib)\//.test(file) && !['middleware.ts', 'next.config.js', 'instrumentation.ts'].includes(file)) continue;
      for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
        const key = m[1]!;
        if (!IGNORED(key) && !registered.has(key)) unregistered.set(key, file);
      }
      for (const m of text.matchAll(/process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g)) {
        const key = m[1]!;
        if (!IGNORED(key) && !registered.has(key)) unregistered.set(key, file);
      }
    }
    expect([...unregistered].map(([k, f]) => `${k} (${f})`), 'register new settings in lib/config-status.ts').toEqual([]);
  });

  it('the Prisma schema env() reads and the env-object reads of the lead alert are registered', () => {
    const registered = new Set(CONFIG_REGISTRY.map((c) => c.key));
    const prisma = files.find((f) => f.file === path.join('prisma', 'schema.prisma'))!.text;
    for (const m of prisma.matchAll(/env\("([A-Z0-9_]+)"\)/g)) expect(registered.has(m[1]!), m[1]).toBe(true);
    const alert = files.find((f) => f.file === path.join('lib', 'lead-alert.ts'))!.text;
    for (const m of alert.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) {
      if (!IGNORED(m[1]!)) expect(registered.has(m[1]!), m[1]).toBe(true);
    }
  });

  it('keys are unique, have a sentence, and the required critical set is critical', () => {
    const keys = CONFIG_REGISTRY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of CONFIG_REGISTRY) {
      expect(c.breaks.length).toBeGreaterThan(20);
      expect(SEVERITY_ORDER).toContain(c.severity);
    }
    const sev = (k: string) => CONFIG_REGISTRY.find((c) => c.key === k)?.severity;
    for (const k of [
      'CRON_SECRET', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_SECRET_KEY', 'DATABASE_URL', 'DIRECT_URL',
      'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'ADMIN_EMAIL',
    ]) expect(sev(k), k).toBe('critical');
    for (const k of [
      'NEXT_PUBLIC_SITE_URL', 'INDEXNOW_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM',
      'ALERT_SMS_TO', 'ERROR_WEBHOOK_URL',
    ]) expect(sev(k), k).toBe('important');
  });
});

describe('no value or value-derived text ever leaves the model', () => {
  // Distinctive, 61 characters long, so a prefix, the whole value or the length would be recognisable.
  const marker = (i: number) => `zq${i}Xk93vLpw02-secret-marker-${String(i).padStart(2, '0')}`.padEnd(61, 'Q');
  const env: Record<string, string> = {};
  CONFIG_REGISTRY.forEach((c, i) => {
    env[c.key] = marker(i);
  });
  // Half the keys unset, one set to whitespace only.
  const partial = { ...env };
  CONFIG_REGISTRY.forEach((c, i) => {
    if (i % 2 === 0) delete partial[c.key];
  });
  partial[CONFIG_REGISTRY[1]!.key] = '   ';

  const leaks = (text: string) => {
    const found: string[] = [];
    for (const value of Object.values(env)) {
      expect(value.length).toBe(61);
      for (let n = 4; n <= value.length; n++) if (text.includes(value.slice(0, n))) found.push(value.slice(0, n));
    }
    if (/\b61\b/.test(text)) found.push('length:61');
    return found;
  };

  it('the serialised model contains no marker, prefix or length', () => {
    for (const e of [env, partial]) {
      const json = JSON.stringify(evaluateConfig(e));
      expect(leaks(json)).toEqual([]);
      expect(json).not.toMatch(/"[^"]*(length|prefix|hash|digest|value)[^"]*":/i);
    }
  });

  it('items expose only registry fields plus one boolean', () => {
    const allowed = ['breaks', 'configured', 'group', 'key', 'severity'];
    for (const item of evaluateConfig(partial).items) {
      expect(Object.keys(item).sort()).toEqual(allowed);
      expect(typeof item.configured).toBe('boolean');
    }
    expect(Object.keys(evaluateConfig(partial)).sort()).toEqual(['headline', 'items', 'level', 'missing']);
  });

  it('whitespace-only counts as not configured', () => {
    expect(isConfigured({ A: '  ' }, 'A')).toBe(false);
    expect(isConfigured({ A: '' }, 'A')).toBe(false);
    expect(isConfigured({}, 'A')).toBe(false);
    expect(isConfigured({ A: 'x' }, 'A')).toBe(true);
  });

  it('the rendered page contains no marker, prefix or length, and only the 7-character commit', async () => {
    session.current = { user: { id: 'a1', role: 'ADMIN', email: 'admin@example.test' } };
    const fullSha = 'abcdef0123456789abcdef0123456789abcdef01';
    const saved = { ...process.env };
    try {
      for (const e of [env, partial]) {
        for (const k of Object.keys(process.env)) delete process.env[k];
        Object.assign(process.env, e, { VERCEL_GIT_COMMIT_SHA: fullSha, VERCEL_ENV: 'production' });
        const { default: Page } = await import('@/app/admin/system/page');
        const html = renderToStaticMarkup(await Page());
        expect(leaks(html)).toEqual([]);
        expect(html).toContain('abcdef0');
        expect(html).not.toContain('abcdef01');
        expect(html).toContain('System status');
      }
    } finally {
      for (const k of Object.keys(process.env)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });

  it('deployFacts shows a short commit and the environment name only', () => {
    expect(deployFacts({ VERCEL_GIT_COMMIT_SHA: 'abcdef0123456789', VERCEL_ENV: 'preview' })).toEqual({ commit: 'abcdef0', environment: 'preview' });
    expect(deployFacts({})).toEqual({ commit: null, environment: null });
  });
});

describe('summary and ordering', () => {
  const critical = CONFIG_REGISTRY.filter((c) => c.severity === 'critical').map((c) => c.key);
  const important = CONFIG_REGISTRY.filter((c) => c.severity === 'important').map((c) => c.key);
  const all = Object.fromEntries(CONFIG_REGISTRY.map((c) => [c.key, 'x']));
  const without = (...keys: string[]) => Object.fromEntries(Object.entries(all).filter(([k]) => !keys.includes(k)));

  it('red when a critical setting is missing, with the count in the headline', () => {
    const m = evaluateConfig(without('CRON_SECRET', 'STRIPE_WEBHOOK_SECRET'));
    expect(m.level).toBe('red');
    expect(m.headline).toBe('2 critical settings missing');
    expect(evaluateConfig(without('CRON_SECRET')).headline).toBe('1 critical setting missing');
    expect(countMissingCritical(without('CRON_SECRET', 'STRIPE_WEBHOOK_SECRET'))).toBe(2);
    expect(countMissingCritical({})).toBe(critical.length);
  });

  it('amber when only important settings are missing, green when none are', () => {
    expect(evaluateConfig(without(important[0]!)).level).toBe('amber');
    expect(evaluateConfig(without('AUTH_GOOGLE_ID')).level).toBe('green');
    expect(evaluateConfig(all).level).toBe('green');
  });

  it('lists missing before configured, and critical before important before optional', () => {
    const items = evaluateConfig(without('AUTH_GOOGLE_ID', important[0]!, 'CRON_SECRET')).items;
    expect(items.slice(0, 3).map((i) => i.severity)).toEqual(['critical', 'important', 'optional']);
    expect(items.slice(0, 3).every((i) => !i.configured)).toBe(true);
    expect(items.slice(3).every((i) => i.configured)).toBe(true);
    const missingOrder = evaluateConfig({}).items.map((i) => SEVERITY_ORDER.indexOf(i.severity));
    expect(missingOrder).toEqual([...missingOrder].sort((a, b) => a - b));
  });

  it('ANTHROPIC_API_KEY is important, because both conversational routes answer 503 without it', () => {
    const item = evaluateConfig({}).items.find((i) => i.key === 'ANTHROPIC_API_KEY');
    expect(item?.severity).toBe('important');
    // The severity is only honest while the code really depends on the key.
    for (const route of ['app/api/chat/route.ts', 'app/api/assistant/chat/route.ts']) {
      const src = readFileSync(path.join(process.cwd().endsWith('apps/web') ? '.' : 'apps/web', route), 'utf8');
      expect(src, `${route} must still guard on ANTHROPIC_API_KEY`).toMatch(/!process\.env\.ANTHROPIC_API_KEY/);
    }
  });

  it('does not throw on a hostile env object', () => {
    expect(() => countMissingCritical(null as never)).not.toThrow();
  });
});

describe('/admin/system is admin-only', () => {
  const load = async () => (await import('@/app/admin/system/page')).default;

  for (const [who, s] of [
    ['anonymous', null],
    ['customer', { user: { id: 'u1', role: 'USER', email: 'c@example.test' } }],
  ] as const) {
    it(`redirects ${who} to /login before evaluating anything`, async () => {
      session.current = s;
      const Page = await load();
      await expect(Page()).rejects.toThrow('REDIRECT:/login');
    });
  }

  it('renders for an admin', async () => {
    session.current = { user: { id: 'a1', role: 'ADMIN', email: 'admin@example.test' } };
    const Page = await load();
    expect(renderToStaticMarkup(await Page())).toContain('System status');
  });

  it('is linked from the admin nav with a defensively-computed critical badge, and has no mutation', () => {
    const layout = readFileSync(path.join(webRoot, 'app/admin/layout.tsx'), 'utf8');
    expect(layout).toContain("href: '/admin/system'");
    expect(layout).toMatch(/try\s*{\s*missingCritical = countMissingCritical\(process\.env\);\s*}\s*catch/);
    const page = readFileSync(path.join(webRoot, 'app/admin/system/page.tsx'), 'utf8');
    expect(page).not.toMatch(/'use server'|<form|fetch\(|@\/lib\/db/);
    expect(readdirSync(path.join(webRoot, 'app/admin/system'))).toEqual(['page.tsx']);
  });
});
