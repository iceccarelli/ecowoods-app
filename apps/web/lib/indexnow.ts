import fs from 'node:fs';
import path from 'node:path';
import { SITE_URL } from '@/lib/seo-data';

/**
 * Runtime IndexNow submission.
 *
 * The key is read from the route directory that serves it — app/<key>.txt —
 * and NOT from `process.env.INDEXNOW_KEY`. That variable is not set in this
 * deployment, deliberately: the key is public by construction, since the entire
 * ownership check is that any search engine can fetch it at that URL. See F-144
 * and F-158.
 *
 * The comment this file used to carry said the key must match a file at
 * apps/web/public/<key>.txt. That directory has never been served on this host
 * (F-131), which is why the key became a route in the first place. Deriving it
 * from the route means the key submitted and the key served cannot disagree.
 *
 * The env var still wins if it is set, for testing against another host.
 */
function resolveKey(): string {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY;
  try {
    const appDir = path.join(process.cwd(), 'app');
    const hit = fs
      .readdirSync(appDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^[0-9a-f]{8,64}\.txt$/i.test(e.name))
      .map((e) => e.name.replace(/\.txt$/i, ''));
    return hit.length === 1 ? hit[0]! : '';
  } catch {
    return '';
  }
}

export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  const key = resolveKey();
  if (!key || urls.length === 0) return false;
  const host = new URL(SITE_URL).host;
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: urls }),
  });
  return res.ok;
}
