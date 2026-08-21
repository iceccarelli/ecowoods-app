#!/usr/bin/env bash
#
# scripts/verify-live.sh — the first check in this repository that reads
# PRODUCTION instead of the repository.
#
# WHY THIS EXISTS
#
# Fourteen guards read the source tree. Every one of them can pass while the
# deployed site is broken, and three times now that is exactly what happened:
#
#   F-107  the staleness clock read "0 days ago" forever — source correct,
#          render wrong, because the page was statically built.
#   F-129  28 diagrams shipped as code with the files left behind — every guard
#          green, every image a broken icon.
#   F-131  apps/web/public has never been served on this host. /icon-192.png has
#          404'd there since long before any of this work. The files were on
#          disk, committed, correct, and unreachable.
#
# One shape, three times: a defect that lives in the gap between the repository
# and what a browser actually receives. No amount of reading the repository
# finds it. Something has to fetch the site.
#
# WHAT IT CHECKS, AND WHY EACH ONE
#
#   1. Key routes return 200. Cheap, and catches a build that deployed a 404.
#   2. AN ACTUAL RENDERED IMAGE. It fetches /framework, pulls the first
#      _next/image URL out of the HTML, and fetches THAT. This is the check that
#      would have caught all three failures above: it does not ask whether a
#      file exists, it asks whether the thing the page points at comes back.
#   3. The machine surfaces — sitemap, feed, llms.txt, the JSON APIs — because
#      those are read by crawlers that will never report a problem to anyone.
#   4. That apps/web/public is still not served, stated as a known fact rather
#      than discovered again. When that changes, this line changes with it.
#
#   bash scripts/verify-live.sh                      # https://ecowoods.ca
#   bash scripts/verify-live.sh https://preview-url  # a deploy preview
#
# Exit code is the number of failures, so it can gate a release.
#
set -uo pipefail

BASE="${1:-https://ecowoods.ca}"
BASE="${BASE%/}"
CB="cb=$(date +%s)"

GRN=$'\033[32m'; RED=$'\033[31m'; YEL=$'\033[33m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
FAILED=0

printf '\n%sLIVE CHECK%s  %s\n\n' "$BOLD" "$OFF" "$BASE"

# code <url> — HTTP status, following redirects, with a cache-buster so a CDN
# cannot hand back a copy from before the deploy being tested.
code() {
  # curl already prints 000 when it cannot connect. Adding `|| echo 000` on top
  # concatenates the two and yields "000000", which matches no expected status
  # and reports every unreachable host as a mystery rather than as unreachable.
  local out
  out="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$1" 2>/dev/null)"
  printf '%s' "${out:-000}"
}

check() {
  local label="$1" url="$2" want="${3:-200}"
  local got; got="$(code "$url")"
  if [ "$got" = "$want" ]; then
    printf '  %sPASS%s  %-34s %s\n' "$GRN" "$OFF" "$label" "$got"
  else
    printf '  %sFAIL%s  %-34s got %s, want %s\n' "$RED" "$OFF" "$label" "$got" "$want"
    printf '        %s\n' "$url"
    FAILED=$((FAILED + 1))
  fi
}

printf '%s── pages %s\n' "$BOLD" "$OFF"
for p in / /framework /framework/assess /guides /glossary /papers /resources /library /data /market /whats-new /standards /authority /technical-library; do
  check "$p" "$BASE$p?$CB"
done

printf '\n%s── machine surfaces %s\n' "$BOLD" "$OFF"
for p in /sitemap.xml /robots.txt /llms.txt /ai.txt /feed.xml /api/knowledge /api/market /api/health; do
  check "$p" "$BASE$p?$CB"
done

printf '\n%s── a real rendered image %s\n' "$BOLD" "$OFF"
# THE check. Everything above proves pages exist; this proves the bytes a page
# asks for actually come back. Pull the first optimised image URL straight out
# of the rendered HTML and fetch it.
HTML="$(curl -s -L --max-time 20 "$BASE/framework?$CB" 2>/dev/null || true)"
# Stop at a quote OR a space. Next renders both `src` and `srcset`, and a
# srcset entry is followed by a descriptor — "…&q=75 1x" — so a pattern that
# only excludes quotes captures the " 1x" too and fetches a URL that cannot
# exist. Caught by running the extractor against real rendered markup instead of
# trusting it.
IMG="$(printf '%s' "$HTML" | grep -o '/_next/image?url=[^" ]*' | head -1 | sed 's/&amp;/\&/g')"

if [ -z "$IMG" ]; then
  printf '  %sFAIL%s  %-34s no /_next/image URL in the HTML\n' "$RED" "$OFF" "diagram on /framework"
  printf '        The page rendered without an optimised image. Either the illustration\n'
  printf '        is not imported (see scripts/gen-illustration-imports.mjs) or it is being\n'
  printf '        referenced by a public/ path, which this host does not serve. See F-131.\n'
  FAILED=$((FAILED + 1))
else
  check "diagram bytes" "$BASE$IMG"
  printf '  %s····%s  %-34s %s\n' "$DIM" "$OFF" "resolved to" "$(printf '%s' "$IMG" | cut -c1-64)"
fi

printf '\n%s── crawler verification %s\n' "$BOLD" "$OFF"
# IndexNow works by the engine fetching the key at this exact URL and comparing
# the body to the key in the submission. It lived in apps/web/public and
# returned 404 for its entire existence, so every submission Bing and Yandex
# received was rejected, silently, with nothing surfacing an error. See F-136.
KEYFILE="8b9dff9a810eacdb42f0c91254401d8b"
check "IndexNow key" "$BASE/$KEYFILE.txt?$CB"
BODY="$(curl -s -L --max-time 20 "$BASE/$KEYFILE.txt?$CB" 2>/dev/null | tr -d '[:space:]')"
if [ "$BODY" = "$KEYFILE" ]; then
  printf '  %sPASS%s  %-34s body matches the key\n' "$GRN" "$OFF" "IndexNow body"
else
  printf '  %sFAIL%s  %-34s body is "%s"\n' "$RED" "$OFF" "IndexNow body" "${BODY:0:40}"
  printf '        Must be exactly the key, or every submission is rejected.\n'
  FAILED=$((FAILED + 1))
fi

# The manifest's icons pointed at two more public/ paths that 404'd, so every
# Android install and Google surface reading it got no brand mark at all.
MAN="$(curl -s -L --max-time 20 "$BASE/manifest.webmanifest?$CB" 2>/dev/null || true)"
ICON="$(printf '%s' "$MAN" | grep -o '"src":"[^"]*"' | head -1 | sed 's/"src":"//;s/"$//')"
if [ -z "$ICON" ]; then
  printf '  %sFAIL%s  %-34s no icon found in the manifest\n' "$RED" "$OFF" "PWA icon"
  FAILED=$((FAILED + 1))
elif [ "${ICON#/_next/}" != "$ICON" ]; then
  check "PWA icon bytes" "$BASE$ICON"
else
  printf '  %sFAIL%s  %-34s manifest points at %s\n' "$RED" "$OFF" "PWA icon" "$ICON"
  printf '        Not a bundled URL. apps/web/public is not served — see F-131.\n'
  FAILED=$((FAILED + 1))
fi

printf '\n%s── structured data %s\n' "$BOLD" "$OFF"
# HowTo is the richest type an answer engine can consume and the papers carry
# seven ordered procedures. If it stops being emitted, nothing else here notices.
PAPER="$(curl -s -L --max-time 20 "$BASE/papers/hardwood-refinishing-machines-and-sequence?$CB" 2>/dev/null || true)"
HOWTO="$(printf '%s' "$PAPER" | grep -o '"@type":"HowTo"' | wc -l | tr -d ' ')"
if [ "${HOWTO:-0}" -gt 0 ]; then
  printf '  %sPASS%s  %-34s %s HowTo block(s) on one paper\n' "$GRN" "$OFF" "HowTo schema" "$HOWTO"
else
  printf '  %sFAIL%s  %-34s none emitted\n' "$RED" "$OFF" "HowTo schema"
  FAILED=$((FAILED + 1))
fi

printf '\n%s── canonical URLs %s\n' "$BOLD" "$OFF"
#
# F-142. The root layout declared alternates.canonical = '/', Next merged it
# down into every page that did not override it, and /technical-library, /blog,
# /case-studies and /products/floorforge each served
#
#     <link rel="canonical" href="https://ecowoods.ca">
#
# telling every crawler they were duplicates of the homepage. 101 URLs in the
# sitemap; roughly one indexed. Fourteen repository guards passed throughout,
# because not one of them had ever read a rendered <head> — that is the whole
# reason this file exists, and this is the check it was missing.
#
# scripts/verify-canonical.mjs now catches it in the source. This catches it in
# the thing that is actually served, which is not always the same thing.
canonical_of() {
  curl -s -L --max-time 20 "$1?$CB" 2>/dev/null \
    | grep -o '<link rel="canonical"[^>]*>' \
    | head -1 \
    | sed 's/.*href="\([^"]*\)".*/\1/'
}

for ROUTE in /technical-library /blog /case-studies /papers /guides /glossary /market; do
  WANT="$BASE$ROUTE"
  GOT="$(canonical_of "$BASE$ROUTE")"
  if [ -z "$GOT" ]; then
    printf '  %sFAIL%s  %-34s no canonical element in the head\n' "$RED" "$OFF" "$ROUTE"
    FAILED=$((FAILED + 1))
  elif [ "${GOT%/}" = "${WANT%/}" ]; then
    printf '  %sPASS%s  %-34s self-canonical\n' "$GRN" "$OFF" "$ROUTE"
  else
    printf '  %sFAIL%s  %-34s points at %s\n' "$RED" "$OFF" "$ROUTE" "$GOT"
    printf '        This page is telling crawlers not to index it. See F-142.\n'
    FAILED=$((FAILED + 1))
  fi
done

printf '\n%s── sitemap lastmod %s\n' "$BOLD" "$OFF"
#
# F-141. Seventy-two of 101 URLs carried the build timestamp, so every one of
# them claimed to have changed today, every day. Google's response to a lastmod
# it cannot trust is to stop reading lastmod for the host, which spends the one
# signal that says "fetch this again" on pages that did not change.
#
# The threshold is deliberately loose: a deploy legitimately changes a handful
# of dated things at once, and /market really is rebuilt hourly. More than a
# third of the file sharing today's date is the shape of a build stamp, not of
# a publication day.
SM="$(curl -s -L --max-time 30 "$BASE/sitemap.xml?$CB" 2>/dev/null || true)"
TOTAL="$(printf '%s' "$SM" | grep -o '<loc>' | wc -l | tr -d ' ')"
TODAY="$(date -u +%Y-%m-%d)"
STAMPED="$(printf '%s' "$SM" | grep -o "<lastmod>$TODAY" | wc -l | tr -d ' ')"
if [ "${TOTAL:-0}" -eq 0 ]; then
  printf '  %sFAIL%s  %-34s no <loc> elements — sitemap unreachable or empty\n' "$RED" "$OFF" "sitemap.xml"
  FAILED=$((FAILED + 1))
else
  LIMIT=$(( TOTAL / 3 ))
  if [ "${STAMPED:-0}" -le "$LIMIT" ]; then
    printf '  %sPASS%s  %-34s %s of %s URLs dated today (limit %s)\n' "$GRN" "$OFF" "lastmod honesty" "$STAMPED" "$TOTAL" "$LIMIT"
  else
    printf '  %sFAIL%s  %-34s %s of %s URLs dated today\n' "$RED" "$OFF" "lastmod honesty" "$STAMPED" "$TOTAL"
    printf '        That is a build stamp, not a publication date. See F-141.\n'
    FAILED=$((FAILED + 1))
  fi
fi

printf '\n%s── known-dead paths (must stay 404) %s\n' "$BOLD" "$OFF"
# apps/web/public is not served on this host. This asserts the fact rather than
# leaving it to be rediscovered: /icon-192.png has lived there since long before
# any of the illustration work and has never been reachable. If this line starts
# FAILING, the Vercel Root Directory was fixed — delete this block and move the
# paper PDFs back into apps/web/public.
GOT="$(code "$BASE/icon-192.png?$CB")"
if [ "$GOT" = "404" ]; then
  printf '  %s····%s  %-34s still 404 — apps/web/public unserved, as expected\n' "$DIM" "$OFF" "/icon-192.png"
else
  printf '  %sWARN%s  %-34s now %s — apps/web/public IS being served\n' "$YEL" "$OFF" "/icon-192.png" "$GOT"
  printf '        The root cause behind F-131 is fixed. Remove this block, and the paper\n'
  printf '        PDFs can go to apps/web/public/papers/ as originally intended.\n'
fi

printf '\n%s── verdict %s\n' "$BOLD" "$OFF"
if [ "$FAILED" -eq 0 ]; then
  printf '  %s✓ live and serving%s\n\n' "$GRN" "$OFF"
else
  printf '  %s✗ %d live failure(s)%s — the deploy is not correct, whatever the build said\n\n' "$RED" "$FAILED" "$OFF"
fi
exit "$FAILED"
