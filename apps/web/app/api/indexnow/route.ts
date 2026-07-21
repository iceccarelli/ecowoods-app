import { submitToIndexNow } from "../../../lib/indexnow";
export async function POST(req: Request) {
  const { urls } = (await req.json().catch(() => ({}))) as { urls?: string[] };
  if (!Array.isArray(urls) || urls.length === 0)
    return Response.json({ ok: false, error: "urls[] required" }, { status: 400 });
  const ok = await submitToIndexNow(urls);
  return Response.json({ ok, count: urls.length });
}
