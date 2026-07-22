import { SITE_URL } from "@/lib/seo-data";

// Runtime submissions read the key from the env var. It MUST equal the name of
// the file committed at apps/web/public/<key>.txt (that file is what search
// engines fetch to verify ownership).
const KEY = process.env.INDEXNOW_KEY ?? "";

export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  if (!KEY || urls.length === 0) return false;
  const host = new URL(SITE_URL).host;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList: urls }),
  });
  return res.ok;
}
