/**
 * /api/deploy-info — which commit is actually answering requests.
 *
 * scripts/verify-live-routes.mjs already proved (2026-09-09, see its own
 * header) that "every guard is green" and "the deployed bytes are what was
 * built" are different claims: a Git integration served `main` while a
 * feature branch's work sat unmerged, every defined route still returned
 * 200, and nothing in the repository could see the gap because the gap was
 * never IN the repository — it was between the repository and the alias.
 * That incident was caught by content going missing (a 404). A deploy that
 * serves the WRONG version of content that still 200s — the exact failure
 * mode this session's own camera-header fix went through en route to
 * landing — has no route-count signature at all. The only way to catch it
 * is to ask the running process what it was built from.
 *
 * `VERCEL_GIT_COMMIT_SHA`/`VERCEL_GIT_COMMIT_REF`/`VERCEL_ENV` are populated
 * automatically by Vercel on every deployment — no configuration, nothing
 * to keep in sync. A commit hash is not a secret (it is already public in
 * the GitHub history this repository lives in); this route adds no new
 * disclosure, just a place to read it without SSH or a Vercel API token.
 *
 * No database, no auth, no per-request work — same posture as /api/health.
 */
export const revalidate = 0;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  return Response.json(
    {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    { headers: { ...CORS, 'cache-control': 'no-store' } },
  );
}
