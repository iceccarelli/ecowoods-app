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

# fetch <url> <outfile> — ONE request. Body lands in <outfile>, status is
# printed. Both facts then describe the SAME response, which is the whole point.
#
# WHY THIS EXISTS (F-149)
#
# The previous body-reading check made two requests and reasoned about them as
# though they described one:
#
#     BODY="$(curl ... "$URL?$CB")"      # request A
#     STATUS="$(code "$URL?$CB")"        # request B
#
# then reported "200, but does not contain X" — a sentence assembled from two
# different HTTP transactions. When request A came back short and request B
# came back 200, the check announced that production was serving a broken
# document. Production was serving it perfectly.
#
# A false FAIL here is worse than no check at all. This is the only thing in the
# repository that can see a delivery failure — F-107, F-129, F-131 and F-140 all
# hid from every source-reading guard — so the moment it cries wolf, the next
# real failure gets waved through as "probably that flaky one again".
#
# Retries are on transport, not on content: curl --retry covers timeouts and
# transient 5xx, so a single dropped connection no longer reads as a broken
# deploy. --max-time is generous because /llms-full.txt is ~72 KB and the first
# request after a deploy is a cold cache miss.
TMPFILES=()
cleanup() { [ "${#TMPFILES[@]}" -gt 0 ] && rm -f "${TMPFILES[@]}"; }
trap cleanup EXIT

fetch() {
  local out
  out="$(curl -s -L --max-time 45 --retry 3 --retry-delay 1 --retry-connrefused \
              -o "$2" -w '%{http_code}' "$1" 2>/dev/null)"
  printf '%s' "${out:-000}"
}

mktmp() { local t; t="$(mktemp)"; TMPFILES+=("$t"); printf '%s' "$t"; }

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

printf '\n%s── content collections %s\n' "$BOLD" "$OFF"
# F-165. /blog/*, /case-studies/* and /design were never checked in production.
# Two of those are the content collections — eleven pages carrying the Article
# and CaseStudy schema — and the third is the configurator. A broken article
# would have been invisible to everything in this repository, which is the exact
# gap this file exists to close.
check "/blog"                    "$BASE/blog?$CB"
check "/blog/{slug}"             "$BASE/blog/subfloor-moisture-testing-protocol?$CB"
check "/case-studies"            "$BASE/case-studies?$CB"
check "/case-studies/{slug}"     "$BASE/case-studies/rosedale-estate-stairs-radiant-heat?$CB"
check "/design"                  "$BASE/design?$CB"
check "/services"                "$BASE/services?$CB"
check "/service-areas"           "$BASE/service-areas?$CB"
check "/service-areas/{city}"    "$BASE/service-areas/etobicoke?$CB"
check "/service-areas/{hood}"    "$BASE/service-areas/rosedale?$CB"

printf '\n%s── brand assets the entity graph claims %s\n' "$BOLD" "$OFF"
# F-162. The Organization node declared logo and image as /icon-512.png and
# /og-image.jpg. Both returned 404 for the life of the project, and every
# structured-data validator passed the markup, because a validator asks whether
# a URL is well-formed and never whether it resolves. This asks.
LOGO="$(curl -s -L --max-time 20 "$BASE/?$CB" 2>/dev/null | grep -o '"logo":"[^"]*"' | head -1 | sed 's/.*"logo":"\([^"]*\)".*/\1/')"
if [ -z "$LOGO" ]; then
  printf '  %sFAIL%s  %-34s no logo in the organisation schema\n' "$RED" "$OFF" "Organization logo"
  FAILED=$((FAILED + 1))
else
  check "Organization logo bytes" "$LOGO"
  # F-167. The header mark was a base64 data URI: no URL, so nothing could
  # crawl, index, link or share the company's own logo. It is a file now, and
  # this asks production whether that file comes back.
  check "brand mark bytes"        "$BASE/brand/ew-mark-192.png"
  check "brand logo bytes"        "$BASE/brand/ew-mark.png"
  printf '  %s····%s  %-34s %s\n' "$DIM" "$OFF" "resolved to" "$(printf '%s' "$LOGO" | cut -c1-58)"
fi

printf '\n%s── machine surfaces %s\n' "$BOLD" "$OFF"
for p in /sitemap.xml /robots.txt /llms.txt /ai.txt /feed.xml /api/knowledge /api/market /api/estimate /api/health; do
  check "$p" "$BASE$p?$CB"
done

printf '\n%s── a real rendered image %s\n' "$BOLD" "$OFF"
# THE check. Everything above proves pages exist; this proves the bytes a page
# asks for actually come back. Pull the first optimised image URL straight out
# of the rendered HTML and fetch it.
FWTMP="$(mktmp)"
FWSTATUS="$(fetch "$BASE/framework?$CB" "$FWTMP")"
HTML="$(cat "$FWTMP")"
if [ "$FWSTATUS" != "200" ]; then
  printf '  %sFAIL%s  %-34s /framework is HTTP %s — no image URL to test\n' "$RED" "$OFF" "diagram bytes" "$FWSTATUS"
  FAILED=$((FAILED + 1))
  HTML=""
fi
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
# One request, not two. This block used to call check() for the status and then
# curl again for the body — the same split that produced a false FAIL on
# /llms-full.txt (F-149). The file is 32 bytes so a dropped body was unlikely,
# but "unlikely" is what the other one was too.
KEYTMP="$(mktmp)"
KEYSTATUS="$(fetch "$BASE/$KEYFILE.txt?$CB" "$KEYTMP")"
BODY="$(tr -d '[:space:]' < "$KEYTMP")"
if [ "$KEYSTATUS" != "200" ]; then
  printf '  %sFAIL%s  %-34s HTTP %s\n' "$RED" "$OFF" "IndexNow key" "$KEYSTATUS"
  printf '        Bing and Yandex fetch this to verify ownership. A 404 here rejects\n'
  printf '        every submission, silently. See F-136.\n'
  FAILED=$((FAILED + 1))
elif [ "$BODY" = "$KEYFILE" ]; then
  printf '  %sPASS%s  %-34s 200, body matches the key\n' "$GRN" "$OFF" "IndexNow key"
else
  printf '  %sFAIL%s  %-34s 200, but body is "%s"\n' "$RED" "$OFF" "IndexNow key" "${BODY:0:40}"
  printf '        Must be exactly the key, or every submission is rejected.\n'
  FAILED=$((FAILED + 1))
fi

# The manifest's icons pointed at two more public/ paths that 404'd, so every
# Android install and Google surface reading it got no brand mark at all.
MANTMP="$(mktmp)"
MANSTATUS="$(fetch "$BASE/manifest.webmanifest?$CB" "$MANTMP")"
MAN="$(cat "$MANTMP")"
if [ "$MANSTATUS" != "200" ]; then
  printf '  %sFAIL%s  %-34s manifest itself is HTTP %s\n' "$RED" "$OFF" "PWA icon" "$MANSTATUS"
  FAILED=$((FAILED + 1))
  MAN=""
fi
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
PAPERTMP="$(mktmp)"
PAPERSTATUS="$(fetch "$BASE/papers/hardwood-refinishing-machines-and-sequence?$CB" "$PAPERTMP")"
PAPER="$(cat "$PAPERTMP")"
if [ "$PAPERSTATUS" != "200" ]; then
  printf '  %sFAIL%s  %-34s the paper itself is HTTP %s — HowTo not assessable\n' "$RED" "$OFF" "HowTo schema" "$PAPERSTATUS"
  FAILED=$((FAILED + 1))
  PAPER=""
fi
HOWTO="$(printf '%s' "$PAPER" | grep -o '"@type":"HowTo"' | wc -l | tr -d ' ')"
if [ "${HOWTO:-0}" -gt 0 ]; then
  printf '  %sPASS%s  %-34s %s HowTo block(s) on one paper\n' "$GRN" "$OFF" "HowTo schema" "$HOWTO"
else
  printf '  %sFAIL%s  %-34s none emitted\n' "$RED" "$OFF" "HowTo schema"
  FAILED=$((FAILED + 1))
fi

printf '\n%s── service pages %s\n' "$BOLD" "$OFF"
# F-146. The LocalBusiness graph emits a Service node per service with an @id of
# /services/{slug}#service. Those resolved to 404 for the life of the project.
# An identifier that does not resolve is the one kind of schema error no
# validator flags, because the JSON is perfectly well-formed.
for SLUG in hardwood-installation floor-refinishing dust-free-sanding floor-restoration stair-refinishing custom-inlays; do
  check "/services/$SLUG" "$BASE/services/$SLUG"
done
check "/services" "$BASE/services"

printf '\n%s── machine-readable editions %s\n' "$BOLD" "$OFF"
#
# The llms.txt proposal asks for clean markdown at each page's URL with `.md`
# appended. App Router cannot express `[slug].md` as a segment, so these URLs
# exist only because a rewrite in next.config.js points them at handlers under
# /md/. A rewrite that does not fire produces a 404 on every one of them while
# tsc, every guard and next build all pass — which is F-131, F-138 and F-144
# three times over. So the rewrite is checked where it either works or does not:
# on the deployed site.
#
# Each is required to return 200 AND to look like the document, not like an
# HTML error page dressed as a 200.
md_check() {
  local label="$1" url="$2" want="$3"
  local tmp status size
  tmp="$(mktmp)"
  status="$(fetch "$url?$CB" "$tmp")"
  size="$(wc -c < "$tmp" | tr -d ' ')"

  # An empty body under a 200 is the one genuinely ambiguous outcome: it is
  # almost always a dropped connection on a cold cache, and occasionally a real
  # route serving nothing. curl --retry does not cover it, because a 200 with
  # zero bytes is not an error as far as HTTP is concerned. So it is retried
  # here, once, deliberately — a health check that goes red on a single dropped
  # connection is a health check people learn to ignore, and this one has to be
  # believed the day it is right.
  if [ "$status" = "200" ] && [ "${size:-0}" -eq 0 ]; then
    sleep 2
    status="$(fetch "$url?$CB-retry" "$tmp")"
    size="$(wc -c < "$tmp" | tr -d ' ')"
  fi

  # Four distinguishable outcomes, because "200 but wrong body" was being used
  # to describe all four and was accurate for none of them.
  if [ "$status" = "000" ]; then
    printf '  %sFAIL%s  %-34s could not be fetched (transport, after 3 retries)\n' "$RED" "$OFF" "$label"
    printf '        %s\n' "$url"
    FAILED=$((FAILED + 1))
  elif [ "$status" != "200" ]; then
    printf '  %sFAIL%s  %-34s HTTP %s\n' "$RED" "$OFF" "$label" "$status"
    FAILED=$((FAILED + 1))
  elif [ "${size:-0}" -eq 0 ]; then
    printf '  %sFAIL%s  %-34s HTTP 200 with an empty body\n' "$RED" "$OFF" "$label"
    printf '        That is a transport failure wearing a 200, not a content failure.\n'
    FAILED=$((FAILED + 1))
  elif head -c 512 "$tmp" | grep -qi '<!DOCTYPE html'; then
    printf '  %sFAIL%s  %-34s %s bytes of HTML — the rewrite did not fire\n' "$RED" "$OFF" "$label" "$size"
    FAILED=$((FAILED + 1))
  elif ! grep -q -- "$want" "$tmp"; then
    printf '  %sFAIL%s  %-34s %s bytes, but does not contain %s\n' "$RED" "$OFF" "$label" "$size" "$want"
    printf '        first line: %s\n' "$(head -1 "$tmp" | cut -c1-72)"
    printf '        %s\n' "$url"
    FAILED=$((FAILED + 1))
  else
    printf '  %sPASS%s  %-34s %s bytes, markdown\n' "$GRN" "$OFF" "$label" "$size"
  fi
}

md_check "/papers/{slug}.md"   "$BASE/papers/hardwood-refinishing-machines-and-sequence.md" "## Provenance"
md_check "/guides/{slug}.md"   "$BASE/guides/solid-vs-engineered-hardwood-toronto.md"       "## Provenance"
md_check "/glossary/{slug}.md" "$BASE/glossary/acclimation.md"                              "## Provenance"
md_check "/services/{slug}.md"      "$BASE/services/floor-refinishing.md"     "## Provenance"
md_check "/service-areas/{slug}.md" "$BASE/service-areas/etobicoke.md"        "## Provenance"
md_check "/llms-full.txt"      "$BASE/llms-full.txt"                                        "complete technical corpus"

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
# Same single-request discipline as md_check, for the same reason: "no canonical
# element in the head" and "we could not fetch the page" are different findings,
# and the first version of this could not tell them apart.
for ROUTE in /technical-library /blog /case-studies /papers /guides /glossary /market; do
  WANT="$BASE$ROUTE"
  TMP="$(mktmp)"
  STATUS="$(fetch "$BASE$ROUTE?$CB" "$TMP")"
  GOT="$(grep -o '<link rel="canonical"[^>]*>' "$TMP" | head -1 | sed 's/.*href="\([^"]*\)".*/\1/')"

  if [ "$STATUS" != "200" ]; then
    printf '  %sFAIL%s  %-34s HTTP %s — page not fetched, canonical unknown\n' "$RED" "$OFF" "$ROUTE" "$STATUS"
    FAILED=$((FAILED + 1))
  elif [ -z "$GOT" ]; then
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
SMTMP="$(mktmp)"
SMSTATUS="$(fetch "$BASE/sitemap.xml?$CB" "$SMTMP")"
SM="$(cat "$SMTMP")"
TOTAL="$(printf '%s' "$SM" | grep -o '<loc>' | wc -l | tr -d ' ')"

# F-168. Google discovers a next/image URL only if a sitemap declares it. Every
# diagram on this site is a hashed /_next/static/media/ path that appears in no
# crawlable list, so until now none of the 28 technical cross-sections was
# findable as an image at all.
IMGCOUNT="$(printf '%s' "$SM" | grep -c '<image:loc>' || true)"
if [ "${IMGCOUNT:-0}" -gt 0 ]; then
  printf '  %sPASS%s  %-34s %s image(s) declared\n' "$GRN" "$OFF" "image sitemap" "$IMGCOUNT"
else
  printf '  %sFAIL%s  %-34s no <image:loc> in sitemap.xml\n' "$RED" "$OFF" "image sitemap"
  printf '        Unlisted means undiscoverable for every JS-rendered image. F-168.\n'
  FAILED=$((FAILED + 1))
fi
TODAY="$(date -u +%Y-%m-%d)"
STAMPED="$(printf '%s' "$SM" | grep -o "<lastmod>$TODAY" | wc -l | tr -d ' ')"
if [ "${TOTAL:-0}" -eq 0 ]; then
  if [ "$SMSTATUS" != "200" ]; then
    printf '  %sFAIL%s  %-34s HTTP %s — not fetched\n' "$RED" "$OFF" "sitemap.xml" "$SMSTATUS"
  else
    printf '  %sFAIL%s  %-34s 200 but no <loc> elements\n' "$RED" "$OFF" "sitemap.xml"
  fi
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

printf '\n%s── the 404 page %s\n' "$BOLD" "$OFF"
# F-155. There was no not-found.tsx, so every mistyped or stale URL got Next's
# built-in page: two lines of text, no header, no footer, not one outbound link.
# Two things are checked, and the second is the one a status code cannot show:
# that the page a visitor actually lands on offers a way back.
NF="$(mktmp)"
NFSTATUS="$(fetch "$BASE/this-page-does-not-exist-$(date +%s)" "$NF")"
NFLINKS="$(grep -o 'href="/[^"]*"' "$NF" | sort -u | wc -l | tr -d ' ')"
if [ "$NFSTATUS" != "404" ]; then
  printf '  %sFAIL%s  %-34s HTTP %s — a missing page must return 404, not %s\n' "$RED" "$OFF" "unknown URL" "$NFSTATUS" "$NFSTATUS"
  printf '        A 200 on a missing page is a soft 404: the crawler indexes an error.\n'
  FAILED=$((FAILED + 1))
elif [ "${NFLINKS:-0}" -lt 10 ]; then
  printf '  %sFAIL%s  %-34s 404, but only %s internal link(s)\n' "$RED" "$OFF" "unknown URL" "$NFLINKS"
  printf '        A dead-end 404 spends a request and teaches nothing. See F-155.\n'
  FAILED=$((FAILED + 1))
else
  printf '  %sPASS%s  %-34s 404, %s internal links out\n' "$GRN" "$OFF" "unknown URL" "$NFLINKS"
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
