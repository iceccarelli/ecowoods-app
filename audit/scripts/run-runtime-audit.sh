#!/usr/bin/env bash
#
# audit/scripts/run-runtime-audit.sh
#
# One command for the whole runtime pass. This exists because the manual
# version had three moving parts — install a browser, start a dev server in a
# second terminal, remember the flags — and so it never got run, which left
# patches 05, 06 and 09 blocked on data nobody could be bothered to produce.
#
#   bash audit/scripts/run-runtime-audit.sh
#
# It will:
#   1. install the Playwright chromium build if it is missing
#   2. build and start the app on a free port (production build — dev-mode
#      timings are meaningless and dev-only overlays pollute the DOM)
#   3. run audit/scripts/runtime-audit.mjs across every public route x
#      10 viewports x both themes
#   4. shut the server down again, whatever happened
#   5. leave audit/runtime-report.json (and audit/shots/ with --shots)
#
# Options are passed straight through:
#   bash audit/scripts/run-runtime-audit.sh --shots
#   bash audit/scripts/run-runtime-audit.sh --skip-axe
#   bash audit/scripts/run-runtime-audit.sh --routes=/,/design
#
# axe-core is optional. If @axe-core/playwright is not installed the accessibility
# pass is skipped and everything else still runs — a partial report beats none.
#
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"
PORT="${PORT:-3111}"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "▸ stopping server (pid $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "▸ 1/4  browser"
if ! node -e "require('playwright')" 2>/dev/null; then
  echo "     playwright not resolvable — installing"
  pnpm add -Dw playwright || { echo "     FAILED: install playwright manually"; exit 2; }
fi
pnpm exec playwright install chromium || {
  echo "     FAILED: could not download chromium."
  echo "     If this machine blocks the download host, run the audit somewhere that doesn't."
  exit 2
}
# `install chromium` fetches the BROWSER. It does not install the shared
# libraries the browser links against, and the Codespaces base image ships
# almost none of them. Without this the first launch dies with
#   libnspr4.so: cannot open shared object file
# which reads like a Playwright bug and is not one.
pnpm exec playwright install-deps chromium || {
  echo "     NOTE: install-deps failed (needs root/apt). If chromium will not"
  echo "     launch, run it manually: pnpm exec playwright install-deps chromium"
}

if node -e "require('@axe-core/playwright')" 2>/dev/null; then
  echo "     @axe-core/playwright present — accessibility pass enabled"
else
  echo "     @axe-core/playwright missing — accessibility pass will be skipped"
  echo "     (install with: pnpm add -Dw @axe-core/playwright, then re-run)"
fi

echo "▸ 2/4  production build"
pnpm --filter @ecowoods/web exec prisma generate >/dev/null || exit 2
pnpm --filter @ecowoods/web build || { echo "     build failed — fix that first"; exit 2; }

echo "▸ 3/4  starting server on :$PORT"
(cd apps/web && PORT="$PORT" pnpm exec next start -p "$PORT" >/tmp/ecowoods-audit-server.log 2>&1) &
SERVER_PID=$!

for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then
    echo "     up after ${i}s"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "     server died on startup — /tmp/ecowoods-audit-server.log:"
    tail -20 /tmp/ecowoods-audit-server.log
    exit 2
  fi
  sleep 1
  [ "$i" = 60 ] && { echo "     server never became ready"; tail -20 /tmp/ecowoods-audit-server.log; exit 2; }
done

echo "▸ 4/4  running the audit"
node audit/scripts/runtime-audit.mjs --base="http://localhost:$PORT" "$@"
STATUS=$?

echo
if [ -f audit/runtime-report.json ]; then
  node -e "
    const r = require('./audit/runtime-report.json');
    const cells = r.results.length;
    const overflow = r.results.filter(x => x.top && x.top.overflow).length;
    const zoom = r.results.filter(x => x.top && x.top.iosZoom.length).length;
    const axe = r.results.filter(x => x.axe && x.axe.length).length;
    const tap = r.results.filter(x => x.top && x.top.tapSmall.length).length;
    const err = r.results.filter(x => x.error).length;
    console.log('── summary ─────────────────────────────');
    console.log('  cells (route x viewport x theme):', cells);
    console.log('  with horizontal overflow        :', overflow);
    console.log('  with a form control under 16px  :', zoom);
    console.log('  with a tap target under 44px    :', tap);
    console.log('  with axe violations             :', axe);
    console.log('  errored                         :', err);
  "
  echo
  echo "wrote audit/runtime-report.json — send this file back and patches 05, 06 and 09 become writable."
else
  echo "no report written — see the output above."
fi

exit $STATUS
