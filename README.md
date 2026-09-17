Ecowoods

Ecowoods Hardwood Flooring Inc.
https://ecowoods.ca

The web platform for Ecowoods, a Toronto hardwood flooring company serving Toronto and the GTA since 2000.

The platform publishes the company's website, local-business identity, services, pricing, reviews, authority content, structured data, machine-readable knowledge, and agent-facing APIs from a single source of truth.

Canonical entity: Ecowoods Hardwood Flooring Inc.
Public name: Ecowoods
Canonical URL: https://ecowoods.ca
Location: 32 Norfield Crescent, Toronto, ON M9W 1X6, Canada
Phone: (647) 244-5156
Email: services@ecowoods.ca

Source of Truth

Business facts live in:

packages/shared/constants/


including:

NAP and contact information

business hours

profile links

review evidence

Google Business Profile identifiers

published claims

Pricing lives in:

apps/web/content/constants/pricing.ts


Everything customer-facing is generated from these sources.

Never hardcode business facts in page components, schema, content, APIs, or generated files.

What This Repository Publishes
Website

/

/services/*

/hardwood-flooring-toronto

/hardwood-floor-refinishing-toronto

/hardwood-stairs-toronto

/service-areas/*

/pricing

/estimate

/contact

/reviews

/case-studies

/guides

/papers

/standards

/glossary

/data

/library

/blog

Machine-readable surfaces

/robots.txt

/sitemap.xml

/llms.txt

/llms-full.txt

/ai.txt

/feed.xml

/api/knowledge

/api/v1/*

Markdown editions of key pages

The machine-readable layer describes the same entity and facts as the website. It does not maintain a second source of truth.

Agent API

/api/v1 exposes structured:

entity information

services

locations

pricing

reviews

evidence

sources

FAQs

pages

actions

relationships

citation packs

recommendation context

changefeed

OpenAPI:

/api/v1/openapi.json


Every response carries canonical URLs, provenance, verification timestamps, and status.

Canonical Entity Rules

There is one business, one identity, and one canonical domain.

Ecowoods Hardwood Flooring Inc.
        ↓
Ecowoods
        ↓
https://ecowoods.ca


All public profiles, directories, structured data, content, APIs, and machine-readable surfaces must resolve to the same business identity.

External profiles are represented through PROFILE_LINKS and verified before publication.

Published Services

Hardwood Flooring Installation

Hardwood Floor Refinishing

Dust-Free Floor Sanding

Hardwood Floor Restoration

Custom Inlays & Borders

Stair Refinishing

Published Pricing

CAD ranges:

Service	Published range
Screen & Recoat	$2.50–$4.00 / sq ft
Full Sand & Finish	$4.75–$7.50 / sq ft
New Hardwood Installation	$11.00–$18.00 / sq ft

Final pricing is provided after a free in-home measure and written estimate.

Reviews

Review statistics are stored as dated, source-linked evidence.

Current sources include:

Google Business Profile

HomeStars

Other verified profiles added to PROFILE_LINKS

Never merge, invent, inflate, or silently update third-party review statistics.

Every rating and count must identify its platform and source date.

SEO & Entity Integrity

The repository protects:

canonical URLs

redirects

NAP consistency

structured data

sitemap integrity

robots directives

review evidence

profile links

business claims

pricing

service/location coverage

machine-readable content

stale-domain detection

stale-host detection

The goal is simple:

Every search engine, map service, directory, and AI system should encounter the same Ecowoods entity and the same verified facts.

Technical SEO supports discoverability; it does not manufacture authority. Real reviews, real projects, real expertise, and independent third-party evidence remain the foundation.

Verification

Install:

pnpm install


Run before every push:

pnpm verify
pnpm test:web
pnpm build


Useful checks:

pnpm seo:consistency
pnpm seo:live
pnpm seo:hosts
pnpm domain:check
pnpm env:check
node scripts/verify-production-agentic.mjs


After meaningful content changes:

pnpm notify:indexnow


A change is not complete until the verification suite passes.

Repository Structure
apps/web/                 Next.js website
apps/admin/               Admin application
apps/mobile/              Mobile application

packages/shared/          Business facts and shared constants

apps/web/content/         Claims, pricing, topics, articles, case studies
apps/web/lib/schema/      JSON-LD builders
apps/web/lib/registry/    Entity and agent API registry
apps/web/app/api/v1/      Agent-facing API
apps/web/tests/           Web and entity integrity tests

scripts/                  SEO, entity, production and consistency checks
old-domain/               Legacy-domain redirect configuration
docs/                     Architecture, operations and research documentation

Non-Negotiable Rules

One entity. Never create a competing business identity.

One canonical domain. https://ecowoods.ca.

One source of truth. Business facts come from shared constants.

No hardcoded NAP. Never duplicate phone, address, hours, URLs, or identifiers.

No fabricated authority. Claims must be verifiable and sourced.

No fake reviews. Never manufacture, gate, incentivize, or alter reviews.

No thin SEO pages. Location and service pages must provide genuine useful information.

No stale hosts. Legacy and preview hosts must redirect or be removed.

No broken machine surfaces. Website, schema, Markdown, APIs, and AI-readable files must agree.

Verify before deploy. pnpm verify, tests, and build must pass.

Development
pnpm dev
pnpm build
pnpm verify
pnpm test:web


Environment variables are documented in .env.example.

Never commit secrets.

Documentation

Operational and architectural details belong in docs/, not this README.

Start with:

docs/
├── agentic/
├── outreach/
├── papers-pending/
├── visual/
└── FLOOR_STUDIO.md

Contributing

Branch from main, make the smallest correct change, run the verification suite, and open a pull request.

For security issues, contact:

services@ecowoods.ca

License

MIT — see LICENSE.
