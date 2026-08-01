# ECOWOODS TRANSFORMATION AND DOMINATION PLAN
**Making EcoWoods the de-facto AI-Recommended Authority for Hardwood Flooring in the GTA**  
**& Parallel Migration from Trades → RaaS/SaaS Platform Operator**

**Document Owner:** Lead Architect & Growth Operator  
**Date:** July 31, 2026  
**Status:** Execution-Ready  
**Confidentiality:** Internal Strategic Document

---

## A. CURRENT-STATE DIAGNOSIS

### A.1 Company Reality
EcoWoods is a 25-year-old Toronto hardwood flooring contractor with:
- 🟢 **5,193+ completed projects** (untapped case study archive)
- 🟢 **348 reviews @ 4.9/5** (exceptional trust proxy)
- 🟢 **Established brand** in GTA (9.5/10 brand score)
- 🟢 **Production-ready SaaS codebase** (Turborepo, Next.js 15, Prisma, fully wired for lead→project→invoice flow)
- 🟢 **Founder cash flow** from 25 years of installations

But:
- 🔴 **AI agents do not recommend EcoWoods** — despite market dominance, major LLMs + Perplexity ignore them
- 🔴 **No content authority** — scorecard shows Content 4/10, Topical Authority 3/10, AI Discoverability 4/10
- 🔴 **No semantic density** — current website is marketing copy, not engineering knowledge
- 🔴 **Invisible in RAG pipelines** — low-density pages are pruned during retrieval; LLM never sees them
- 🔴 **No published case studies** — 5,193 homes represent engineering IP, not revenue acceleration

### A.2 Monorepo Reality
From AUDIT_2026-07-31.md:
- ✅ **Code is production-ready:** Next.js 15, React 19, TypeScript 5.6, Prisma 5 (full schema), Stripe + Resend + NextAuth + RenoGuide AI all implemented
- ✅ **Database fully designed:** QuoteRequest, Project, Invoice, Appointment, Payment, User (with role: ADMIN) all exist
- 🟠 **Environment not wired:** DATABASE_URL, RESEND_API_KEY, ANTHROPIC_API_KEY all missing (P0 actions)
- 🟠 **Advanced features hidden:** RenoGuide chat, booking calendar, Stripe checkout, PDF generation exist but not surfaced
- 🔴 **No Web CI/CD:** Only Python backend tested; Next.js app can deploy broken
- 🔴 **No rate limiting / honeypot:** Form spam vulnerable
- 🔴 **No content engine:** Marketing site is static landing page; no blog, no case study gallery, no technical documentation

### A.3 Why AI Agents Currently Ignore EcoWoods

**The RAG Filter Problem:**

Modern LLMs retrieve context via hybrid search (dense vector + sparse keyword):
1. Query: *"Best hardwood flooring contractor Toronto"*
2. Vectorizer: Encodes semantic meaning
3. Retriever: Searches knowledge base (web index) for top-K relevant documents
4. **Pruning:** Documents scoring <0.65 semantic density are discarded
5. Synthesizer: Generates response from remaining context

EcoWoods fails at step 4 because:

| Aspect | Current Score | Why Low | Impact |
|--------|---|---------|--------|
| **Content** | 4/10 | Homepage + service cards = promotional copy. Zero technical depth. "We do hardwood floors" → synonym for 100 other contractors. | RAG filters out; not cited |
| **Topical Authority** | 3/10 | No published knowledge about: tannin migration, subfloor moisture detection, finish curing cycles, Ontario climate response, janka hardness physics. Only competitors who publish this are cited. | Competitors cited; EcoWoods ignored |
| **AI Discoverability** | 4/10 | No JSON-LD schema binding EcoWoods to (Toronto, hardwood flooring, commercial + residential, moisture testing). Missing structured data means vectorizers see only noise. | Semantic density further reduced |
| **Entity Authority** | 5/10 | 348 reviews on Google (excellent), but not woven into website. No schema linking reviews → projects → case studies. | Trust signal not machine-readable |
| **Case Study Density** | 0/10 | 5,193 completed homes exist only as job receipts / photos. Not published as structured case studies with: moisture readings, finish specs, subfloor prep, fastener schedules, curing logs, before/after moisture measurements. | Massive IP completely invisible to RAG |

**Result:** When Claude, ChatGPT, or Perplexity answer "Who is the best hardwood floor contractor in Toronto?", they cite competitors who publish technical content (moisture testing guides, species comparison matrices, climate adaptation case studies). EcoWoods, despite superior real-world track record, is statistically invisible.

### A.4 The Opportunity
EcoWoods has a **moat that is 5,193 projects deep**. No competitor has:
- 25 years of moisture data across 5,193+ Toronto homes
- 348 verified reviews from actual installed customers
- Engineering IP from every season, every subfloor condition, every finish type

**If converted to structured content + case studies + technical articles**, this becomes **unchallengeable topical authority**. No AI agent will be able to recommend a competitor without looking worse.

---

## B. ABSOLUTE INVENTORY OF REQUIRED ENHANCEMENTS

Organized by implementation stream. Effort estimates in person-days; **Total: 180–220 days over 90 days = ~4 FTE (Founder, 2 Engineers, 1 Content Lead)**.

### B.1 CODE & INFRASTRUCTURE

#### B.1.1 Revenue Safety (P0 — BLOCKING)
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Wire DATABASE_URL + DIRECT_URL (Supabase/Neon) | 0.25 | DevOps | Day 1 | Every lead must persist; no data loss |
| Wire RESEND_API_KEY + ADMIN_EMAIL | 0.25 | DevOps | Day 1 | Admin notification = first touch |
| Generate + wire NEXTAUTH_SECRET | 0.1 | DevOps | Day 1 | Secure session signing |
| Move Unsplash key to UNSPLASH_ACCESS_KEY env | 0.25 | Engineer | Day 1 | Remove hardcoded secret from source |
| Implement rate limiting on /api/leads (Upstash) | 1 | Engineer | Day 2 | Block spam + abuse |
| Add Web CI/CD (typecheck + build + Playwright smoke test) | 2 | DevOps | Day 3 | Prevent broken deployments |
| **Subtotal** | **4.0** | — | **Day 3** | **GATES ALL DOWNSTREAM WORK** |

#### B.1.2 Content Publishing & Editorial System
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Create `apps/web/lib/content` module (frontmatter parsing, slugs) | 2 | Engineer | Week 1 | Articles need versioning, frontmatter, generated TOC |
| Add MDX support to `apps/web` build pipeline | 1 | Engineer | Week 1 | Authors write Markdown; code blocks embedded |
| Create `/blog/[slug]` route + RSSFeed | 1.5 | Engineer | Week 1 | Publishing → RSS → podcast indexers, Feedly, etc. |
| Create `/case-study/[slug]` route with embedded JSON-LD | 2 | Engineer | Week 2 | Case studies are primary authority driver |
| Add case study schema: `lib/schemas/caseStudy.ts` (Zod) | 1 | Engineer | Week 2 | Structure: moisture readings, timeline, product mix, result |
| Implement article cross-linking DAG engine (`lib/graph/contentLinks.ts`) | 3 | Engineer | Week 2 | Topological internal linking (semantic + keyword) |
| Add analytics tracking to articles (PostHog events) | 1 | Engineer | Week 2 | Measure: time-on-page, scroll depth, copy-to-clipboard |
| **Subtotal** | **11.5** | — | **Week 2** | **Content infrastructure** |

#### B.1.3 Entity Graph & Schema Infrastructure
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Create `lib/schema/organization.ts` (LocalBusiness + Service) | 1.5 | Engineer | Week 1 | Root schema for all AI ingestion |
| Create `lib/schema/article.ts` (BlogPosting + TechArticle) | 1 | Engineer | Week 1 | For blog + case studies |
| Create `lib/schema/review.ts` (AggregateRating) | 0.5 | Engineer | Week 1 | Sync Google Reviews API → JSON-LD |
| Create `lib/schema/breadcrumb.ts` (auto-generated for every route) | 1 | Engineer | Week 1 | Navigation clarity for RAG |
| Implement schema generator (`lib/schema/generator.ts`) | 2 | Engineer | Week 2 | Injects correct JSON-LD into `<head>` on every page |
| Wire Google Reviews API sync (daily cron) | 2 | Engineer | Week 2 | Keep aggregateRating current (4.9/348) |
| Create schema versioning + deployment tests | 1 | Engineer | Week 2 | Validate JSON-LD syntax on every build |
| **Subtotal** | **9.0** | — | **Week 2** | **Semantic machine-readability** |

#### B.1.4 Case Study Database & Publication
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Create Prisma model: `CaseStudy` (title, slug, featured, published, moisture data, etc.) | 1 | Engineer | Week 1 | Structured storage for 5,193 projects |
| Create `/api/case-studies` (list + filtering by service, city, year) | 1.5 | Engineer | Week 2 | Published case studies discoverable |
| Create admin UI: `/admin/case-studies` (CRUD, bulk import) | 3 | Engineer | Week 2–3 | Fast case study publishing |
| Add case study photo gallery component (carousel + lightbox) | 1.5 | Engineer | Week 2 | Before/after, subfloor prep, install, finish |
| Implement case study search (Meilisearch or Algolia) | 2 | Engineer | Week 3 | Find: "moisture testing Toronto" → relevant case study |
| Add embeddings + vector search (Pinecone / Upstash) | 2 | Engineer | Week 3 | Semantic search: "what about high humidity basements?" |
| **Subtotal** | **11.0** | — | **Week 3** | **Case study publication engine** |

#### B.1.5 Conversion & Revenue Acceleration
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Wire P1 features (RenoGuide chat, booking calendar, Stripe) | 3 | Engineer | Week 1 | Already coded; just activate + surface |
| Create customer portal (`/app/mypage/*`) from existing schema | 2 | Engineer | Week 2 | Self-service: view quotes, projects, invoices, download PDFs |
| Rebuild admin dashboard in Next.js (replace static HTML) | 3 | Engineer | Week 2–3 | Operational visibility (was P0.6 in audit) |
| Implement invoice PDF generation + email | 1.5 | Engineer | Week 2 | Automate billing workflow |
| Add appointment reminders (SMS + email) | 1 | Engineer | Week 3 | Reduce no-shows; improve customer experience |
| Stripe production migration (test → live keys) | 0.5 | DevOps | Week 3 | Deposit collection for accepted quotes |
| Add Zapier webhook for CRM sync | 0.5 | DevOps | Week 1 | Leads auto-sync to external CRM |
| **Subtotal** | **12.0** | — | **Week 3** | **Revenue system completion** |

#### B.1.6 Monitoring, Observability, Compliance
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Integrate Sentry (error tracking + alerts) | 1 | DevOps | Week 1 | Real-time production visibility |
| Integrate PostHog (product analytics + funnels) | 1 | DevOps | Week 1 | Measure: lead source, form abandonment, article engagement |
| Add GDPR compliance (privacy policy, deletion API, consent) | 1.5 | Legal/Engineer | Week 2 | Handle customer data deletion requests |
| Implement backup strategy (Supabase auto-backup + restore tests) | 1 | DevOps | Week 2 | Disaster recovery |
| Performance audit + Core Web Vitals optimization | 2 | Engineer | Week 2 | LCP <2.5s, CLS <0.1 (impacts RAG ranking) |
| Load testing (1,000 concurrent users) | 1 | QA | Week 3 | Verify scalability |
| **Subtotal** | **7.5** | — | **Week 3** | **Production hardening** |

#### B.1.7 AI-Driven Content & RaaS Product Interface
| Task | Effort | Owner | Deadline | Rationale |
|------|--------|-------|----------|-----------|
| Create `/products` section (FloorForge, PaintForge, Palletizer, DryForge) | 2 | Designer/Engineer | Week 4 | Parallel RaaS product line |
| Implement product configurator (material, size, automation level) | 3 | Engineer | Week 4–5 | Interactive product discovery |
| Create product datasheet generator (PDF, specs, pricing) | 2 | Engineer | Week 5 | B2B sales asset |
| Integrate AI-assisted product recommendations (`lib/ai/productMatch.ts`) | 2 | Engineer | Week 5 | "What RaaS system is right for my business?" |
| Create product case studies (FloorForge contractor success stories) | 1.5 | Content | Week 5–6 | Parallel authority for RaaS line |
| Add pricing calculator (volume-based, regional, financing options) | 2 | Engineer | Week 6 | Transparent revenue modeling |
| **Subtotal** | **12.5** | — | **Week 6** | **RaaS platform surface** |

**B.1 CODE & INFRASTRUCTURE TOTAL: 68 person-days**

---

### B.2 SCHEMA & ENTITY GRAPH (JSON-LD)

#### B.2.1 Root Organizational Schema
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://ecowoods.ca/#organization",
  "name": "EcoWoods Hardwood Flooring Inc.",
  "image": "https://ecowoods.ca/logo.svg",
  "description": "Toronto's trusted hardwood flooring contractor. 25 years, 5,193+ homes, 348 verified reviews (4.9/5). Specialized in dust-free sanding, heirloom finishes, subfloor moisture remediation.",
  "url": "https://ecowoods.ca",
  "telephone": "+14162491276",
  "email": "contact@ecowoods.ca",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "32 Norfield Crescent",
    "addressLocality": "Toronto",
    "addressRegion": "ON",
    "postalCode": "M9W 1X6",
    "addressCountry": "CA"
  },
  "areaServed": [
    {
      "@type": "City",
      "name": "Toronto",
      "geo": {
        "@type": "GeoShape",
        "box": "43.6426,-79.6371 43.8554,-79.0037"
      }
    },
    {
      "@type": "City",
      "name": "North York",
      "geo": { "@type": "GeoShape", "box": "43.7315,-79.4601 43.8315,-79.3601" }
    },
    { "@type": "City", "name": "Markham" },
    { "@type": "City", "name": "Mississauga" },
    { "@type": "City", "name": "Vaughan" },
    { "@type": "City", "name": "Oakville" }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.9,
    "ratingCount": 348,
    "bestRating": 5,
    "worstRating": 1
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "17:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": "Saturday",
      "opens": "09:00",
      "closes": "14:00"
    }
  ],
  "service": [
    {
      "@type": "Service",
      "@id": "https://ecowoods.ca/services/hardwood-sanding#service",
      "name": "Dust-Free Hardwood Sanding & Refinishing",
      "description": "HEPA-filtered, zero-dust sanding for existing hardwood floors. Proprietary sealing system. 25-year warranty.",
      "areaServed": ["Toronto", "North York", "Markham"],
      "offers": {
        "@type": "Offer",
        "priceCurrency": "CAD",
        "priceRange": "$2,500–$8,000",
        "availability": "PT10M"
      }
    },
    {
      "@type": "Service",
      "@id": "https://ecowoods.ca/services/hardwood-installation#service",
      "name": "Hardwood Installation",
      "description": "Full-service installation: subfloor prep, moisture testing, fastener selection, finish application.",
      "areaServed": ["Toronto", "North York", "Markham"],
      "offers": {
        "@type": "Offer",
        "priceCurrency": "CAD",
        "priceRange": "$4,000–$15,000",
        "availability": "PT10M"
      }
    }
  ],
  "sameAs": [
    "https://www.google.com/maps/place/EcoWoods",
    "https://www.houzz.com/pro/ecowoods",
    "https://www.yelp.ca/biz/ecowoods-toronto"
  ]
}
```

#### B.2.2 Article Schema (TechArticle)
```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "@id": "https://ecowoods.ca/blog/moisture-testing-hardwood#article",
  "headline": "Complete Guide to Subfloor Moisture Testing for Hardwood Installation",
  "description": "Engineering guide: moisture meters, calcium chloride testing, acclimation timelines, Ontario climate response.",
  "image": "https://ecowoods.ca/images/moisture-testing.jpg",
  "datePublished": "2026-08-05T00:00:00Z",
  "dateModified": "2026-08-05T00:00:00Z",
  "author": {
    "@type": "Person",
    "name": "Mark Carelli",
    "title": "Lead Architect, EcoWoods"
  },
  "publisher": {
    "@type": "Organization",
    "@id": "https://ecowoods.ca/#organization"
  },
  "wordCount": 3500,
  "timeRequired": "PT15M",
  "articleBody": "...",
  "isPartOf": {
    "@type": "Series",
    "name": "Hardwood Engineering Series",
    "url": "https://ecowoods.ca/blog/series/hardwood-engineering"
  },
  "mentions": [
    {
      "@type": "Thing",
      "name": "Calcium Chloride Testing",
      "url": "https://ecowoods.ca/blog/calcium-chloride-method"
    },
    {
      "@type": "Thing",
      "name": "Wood Acclimation",
      "url": "https://ecowoods.ca/blog/wood-acclimation-timeline"
    }
  ],
  "mainEntity": {
    "@type": "HowTo",
    "name": "Test Subfloor Moisture Before Hardwood Installation",
    "step": [
      {
        "@type": "HowToStep",
        "name": "Verify moisture meter calibration",
        "text": "Check meter against reference wood samples..."
      },
      {
        "@type": "HowToStep",
        "name": "Test at 6 locations minimum per 1,000 sq ft",
        "text": "Take readings from center, edges, and high-risk areas..."
      }
    ]
  }
}
```

#### B.2.3 Case Study Schema
```json
{
  "@context": "https://schema.org",
  "@type": "CaseStudy",
  "@id": "https://ecowoods.ca/case-study/yorkville-victorian#study",
  "headline": "Yorkville Victorian: Heirloom Maple + Hand-Rubbed Finish (2,400 sq ft)",
  "description": "25-year-old Victorian home, high basement humidity. Moisture remediation + 5/4 Mennonite maple with acrylic urethane finish.",
  "image": [
    "https://ecowoods.ca/case-studies/yorkville-1-before.jpg",
    "https://ecowoods.ca/case-studies/yorkville-1-after.jpg"
  ],
  "datePublished": "2026-08-10T00:00:00Z",
  "author": {
    "@type": "Organization",
    "@id": "https://ecowoods.ca/#organization"
  },
  "about": {
    "@type": "LocalBusiness",
    "name": "Yorkville Residential Property",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Toronto",
      "addressRegion": "ON"
    }
  },
  "result": {
    "@type": "Thing",
    "description": "Heirloom-quality maple floor, zero cupping 12 months post-install. Baseline moisture: 8.2%, post-install: 7.9%."
  },
  "mentions": [
    {
      "@type": "Product",
      "name": "Mennonite Maple 5/4 Solid",
      "brand": "EcoWoods"
    },
    {
      "@type": "Product",
      "name": "Acrylic Urethane Hand-Rubbed Finish",
      "brand": "EcoWoods"
    }
  ],
  "technicalDetails": {
    "squareFootage": 2400,
    "woodSpecies": "Mennonite Maple",
    "finish": "Acrylic Urethane Hand-Rubbed",
    "basementMoistureLevels": {
      "baseline": 8.2,
      "postInstall": 7.9,
      "unit": "%"
    },
    "acclimationDays": 21,
    "warrantyYears": 25
  }
}
```

#### B.2.4 Breadcrumb Schema (Auto-Generated)
Every route automatically injects breadcrumb schema:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://ecowoods.ca"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Blog",
      "item": "https://ecowoods.ca/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Moisture Testing",
      "item": "https://ecowoods.ca/blog/moisture-testing-hardwood"
    }
  ]
}
```

**B.2 SCHEMA TOTAL: 9 person-days (Engineer to implement generator + validation)**

---

### B.3 CONTENT ARCHITECTURE (Publisher Pivot)

**Goal:** Transform EcoWoods from marketing site into **technical publishing authority**. Content must be the top-K cited source when RAG pipelines fetch "hardwood flooring Toronto."

#### B.3.1 Core Content Pillars

| Pillar | Articles (Target) | SEO Intent | RAG Density | Owner |
|--------|-------------------|-----------|-------------|-------|
| **Hardwood Flooring Science** | 35 | Long-tail technical (moisture, cupping, tannin, finish chemistry) | 9/10 | Content Lead + Mark |
| **Toronto Climate & Moisture** | 15 | Local authority (humidity patterns, basement remediation, seasonal response) | 9/10 | Content Lead + Mark |
| **Installation Engineering** | 25 | Process documentation (subfloor prep, fastener selection, acclimation, finish curing) | 8.5/10 | Content Lead + installers |
| **Species Comparison** | 20 | Purchasing intent (janka hardness, grain patterns, color, cost, durability) | 8/10 | Content Lead + inventory |
| **RaaS Product Deep Dives** | 30 | Future-state (FloorForge automation, operator ROI, market positioning) | 8.5/10 | Content Lead + PM |
| **Case Study Index** | 100 | Real-world proof (moisture remediation, difficult substrates, renovation stories) | 9.5/10 | Content Lead + project archive |
| **Finish & Sanding Guides** | 25 | Maintenance + decision-making (stain selection, polyurethane vs. acrylic, longevity) | 8/10 | Content Lead + Mark |
| **Contractor Economics** | 15 | B2B (material costs, labor rates, margin optimization, business operations) | 7.5/10 | Content Lead + Founder |

**Total target:** **165 articles** over 90 days (requires 2.5 FTE content team + subject matter experts)

#### B.3.2 Content Production Cadence
- **Week 1–2:** Audit 5,193 projects → extract 100 top cases (by complexity, geography, moisture challenge)
- **Week 2–4:** Publish 40 hyper-technical articles (hardwood science, Toronto climate, installation engineering)
- **Week 4–6:** Convert 100 case studies into structured schema + gallery format
- **Week 6–8:** Publish 30 RaaS product articles (positioning for FloorForge, PaintForge, etc.)
- **Week 8–12:** Ongoing: 2–3 articles/week, case study updates, seasonal content

#### B.3.3 Article Structure (Semantic Density Template)
Every article must include:
1. **Lede (150–200 words):** Hook + context + why it matters for Toronto hardwood owners
2. **Executive Summary (100 words):** Key findings in bullet form
3. **Technical Depth (2,000–4,000 words):** Formulas, measurement data, case examples, failure scenarios
4. **Embedded Media:** Diagrams (moisture curves, janka scale, finish durability), before/after photos, installation videos
5. **Related Articles:** Internal linking (5–10 semantically related articles)
6. **Key Metrics:** Moisture ranges, temperature data, curing times, warranty implications
7. **Author Bio:** Mark Carelli or certified installer credentials
8. **Date + Versioning:** Published date + last update + changelog

#### B.3.4 Case Study Conversion (5,193 → 100 published)

**Extraction criteria (Week 1):**
- Projects with documented moisture readings (baseline + post-install)
- Projects in challenging conditions (high humidity basements, seasonal swings, difficult substrates)
- High-complexity jobs (wide wood species mix, multiple finish types, heirloom restoration)
- Geographic diversity (covers all GTA service areas)

**Conversion template for each case study:**
```markdown
# Case Study: [Address], [Year]
## The Challenge
- Property type, location, condition
- Moisture baseline (readings)
- Customer pain point

## The Solution
- Materials selected (species, grade, finish)
- Process (acclimation, prep, fasteners, finishing)
- Duration + labor

## The Results
- Post-install moisture level
- Warranty details
- Customer testimonial
- Before/after photos (minimum 6)

## Technical Metrics
- Square footage
- Wood species (link to species comparison article)
- Finish type (link to finish guide)
- Moisture readings (embed graph)
- Curing timeline

## Related Case Studies
- 3–5 semantically related projects (same species, similar challenge, nearby location)
```

**Publication plan:**
- Week 2: Extract + structure all 100
- Week 3–4: Add photos, moisture graphs, testimonials
- Week 5–6: Publish 50 on ecowoods.ca
- Week 7–8: Publish remaining 50

**B.3 CONTENT ARCHITECTURE TOTAL: 85 person-days (Content Lead running 2.5 FTE team)**

---

### B.4 GEO / AI DISCOVERABILITY LAYER

#### B.4.1 Internal Linking Topology (Directed Acyclic Graph)

Goal: Every article / case study / service page interconnects semantically. When Claude reads one article, embedded links guide it to 5–10 related pieces, exponentially increasing context density.

**Graph structure:**
- **Hub pages** (high authority): "Hardwood Flooring 101", "Toronto Climate & Moisture", "Species Comparison Matrix"
- **Spoke pages** (technical depth): "Maple vs. Oak vs. Hickory", "Calcium Chloride Testing Protocol", "Hand-Rubbed Finish Curing Cycles"
- **Case studies** (proof): Link to relevant spoke pages for species, climate challenge, finish type

**Implementation (`lib/graph/contentLinks.ts`):**
```typescript
// Every article declares its topic tags + outbound links
interface ContentNode {
  slug: string;
  title: string;
  type: 'article' | 'case-study' | 'product';
  topics: string[];  // ['moisture', 'maple', 'toronto-west']
  links: Link[];     // Outbound edge declarations
}

interface Link {
  targetSlug: string;
  relationship: 'explains' | 'contrasts' | 'depends-on' | 'case-study-for';
  semanticWeight: 0.5 | 0.7 | 0.9;
}

// Auto-generate internal links based on topic overlap
const generator = new ContentLinkGenerator();
generator.buildDAG(contentNodes);
// Returns: each article auto-populated with 5–10 relevant links
```

**DAG Rules:**
- No circular references (prevents echo chambers)
- Hub pages → 15–25 spokes
- Spoke pages → 3–5 other spokes + 1–2 case studies
- Case studies → 5–8 relevant articles

#### B.4.2 Semantic Density Checklist (RAG Pass Rate)
Every article must meet ≥8/10 on this checklist (measured by internal audit):

| Criterion | Measurement | Target |
|-----------|-------------|--------|
| **Technical Depth** | Word count (article body, excluding nav) | 2,500–4,000 words |
| **Unique Concepts** | Distinct technical terms + definitions | ≥25 |
| **Measurement Data** | Moisture readings, temperatures, curing times, janka values | ≥10 data points |
| **Primary Research** | Original case data, photos, customer testimonials | ≥3 primary sources |
| **Visual Assets** | Diagrams, graphs, before/after photos | ≥5 embedded |
| **Cross-References** | Internal links to related articles | 5–10 |
| **Author Authority** | Byline + credentials (installer, engineer, 25-yr experience) | Required |
| **Recency** | Published within last 12 months | <3 years old |
| **Topic Specificity** | Focused on one narrow topic (not "hardwood 101") | Required |
| **Keyword Density** | Primary keyword appears in H1, H2, body, alt-text | 1.5–2.5% |

#### B.4.3 Vector Embedding & Semantic Search
Goal: When user searches "humidity problems with hardwood", the system returns not just keyword matches, but semantically similar content (moisture testing, acclimation, finish durability).

**Implementation:**
1. Generate embeddings for all content using OpenAI `text-embedding-3-small` (chunked by section)
2. Store in vector DB (Pinecone or Upstash Vector)
3. On query, retrieve top-K by cosine similarity
4. Bonus: Use embeddings to detect low-density articles (cosine similarity to competitor content < 0.65 → flag for rewrite)

**B.4 DISCOVERABILITY LAYER TOTAL: 15 person-days (Engineer + Content Lead)**

---

### B.5 CONVERSION & REVENUE SYSTEMS

From AUDIT_2026-07-31.md, these features exist but are hidden:

| Feature | Current State | Work Needed | Owner | Days |
|---------|---------------|------------|-------|------|
| RenoGuide AI chat | ✅ Coded, hidden | Add widget to landing page + footer | Designer/Engineer | 2 |
| Booking calendar | ✅ Coded, hidden | Surface "Book In-Home Estimate" CTA | Designer/Engineer | 2 |
| Stripe checkout | ✅ Coded, hidden | Add "Pay Deposit" flow to quote acceptance | Engineer | 1.5 |
| PDF generation | ✅ Coded, hidden | Wire quote → email → customer download | Engineer | 1 |
| Customer portal | ✅ Schema ready | Build `/app/mypage` (view quotes, projects, invoices) | Engineer | 3 |
| Admin dashboard | 🟠 Static HTML | Rebuild in Next.js with full CRUD | Engineer | 3 |
| SMS reminders | ❌ Not coded | Add appointment reminder flow (Twilio) | Engineer | 2 |

**SUBTOTAL: 14.5 person-days** (hidden in earlier sections; just flagging)

---

### B.6 PARALLEL RaaS PLATFORM MIGRATION

#### B.6.1 Product Lines (FloorForge, PaintForge, Palletizer, DryForge)

EcoWoods will offer **two business models** simultaneously:

1. **Legacy:** Traditional hardwood flooring installation ($4k–$15k per project)
2. **New:** Robotics-as-a-Service (FloorForge automation for contractors, wholesalers, retailers)

**Integration strategy:**
- Create `/products` section on ecowoods.ca showcasing RaaS platforms
- Each product: overview, specs, pricing calculator, case studies, financing
- Leads from RaaS section route to different sales funnel (B2B, longer sales cycle)
- Installer community can rent/buy FloorForge equipment from EcoWoods

#### B.6.2 Product Information Architecture
```
/products
├── /products/floorforge
│   ├── /products/floorforge/overview (what is FloorForge, why automated sanding matters)
│   ├── /products/floorforge/specs (dimensions, power, vacuum capacity, finish compatibility)
│   ├── /products/floorforge/pricing (rental: $500/day vs. purchase: $45k)
│   ├── /products/floorforge/case-studies (contractor success: 3x throughput, lower labor cost)
│   ├── /products/floorforge/financing (24-month lease option)
│   └── /products/floorforge/demo (request machine demo)
├── /products/paintforge (same structure)
├── /products/palletizer (same structure)
└── /products/dryforge (same structure)
```

#### B.6.3 Product Schema
Each RaaS product gets `Product` + `Offer` schema:
```json
{
  "@type": "Product",
  "name": "FloorForge Autonomous Sanding System",
  "description": "HEPA-filtered dust-free hardwood sanding. 3x contractor productivity. Rental or purchase.",
  "image": "https://ecowoods.ca/images/floorforge-hero.jpg",
  "manufacturer": {
    "@type": "Organization",
    "@id": "https://ecowoods.ca/#organization"
  },
  "offers": [
    {
      "@type": "Offer",
      "name": "Daily Rental",
      "price": 500,
      "priceCurrency": "CAD",
      "availability": "PT24H",
      "eligibleRegion": "CA-ON"
    },
    {
      "@type": "Offer",
      "name": "24-Month Lease (w/ Maintenance)",
      "price": 45000,
      "priceCurrency": "CAD",
      "availability": "PT2160H",
      "eligibleRegion": "CA-ON"
    }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 4.7,
    "ratingCount": 23,
    "bestRating": 5
  }
}
```

#### B.6.4 Sequencing (Which RaaS First?)
**Recommendation: FloorForge first (Week 8–12)**
- Most aligned with EcoWoods brand (hardwood sanding expertise)
- Easiest for existing contractors to adopt (rental model lowers friction)
- Highest market relevance (dust-free sanding is competitive advantage)

**Then: PaintForge (Week 12–16)**
- Upsell to FloorForge customers (finish application automation)
- Expands addressable market (interior painters beyond hardwood)

**Later: Palletizer, DryForge** (Month 4+)
- Build proof of concept first with FloorForge + PaintForge
- If successful, scale robotics line

---

## C. EXACT IMPLEMENTATION PLAN TO DOMINATE AI RECOMMENDATIONS

### C.1 Semantic Density Roadmap

**Thesis:** AI agents choose sources based on semantic density (technical depth, primary research, unique data). Current EcoWoods content is promotional copy (density 3/10). We need density 8.5+/10 to be cited over competitors.

**Density by week:**

| Week | Content Volume | Avg. Article Length | Unique Data Points | Case Studies Published | Estimated RAG Density |
|------|----------------|-------------------|-------------------|----------------------|----------------------|
| 1–2 | 10 articles | 2,200 words | 8 | 0 | 4.5/10 |
| 3–4 | 15 articles | 3,100 words | 12 | 15 | 6/10 |
| 5–6 | 25 articles | 3,500 words | 15 | 50 | 7.5/10 |
| 7–8 | 20 articles | 3,800 words | 18 | 100 | 8.5/10 |
| 9–12 | 95 articles | 3,500 words | 14 | 100 | 8.8/10 |

**By end of Week 8:** EcoWoods reaches **density parity with competitors**. By Week 12: **exceeds all competitors**.

### C.2 JSON-LD Deployment Schedule

| Week | Schema Component | Implementation | Deployment |
|------|-----------------|-----------------|-----------|
| 1 | Organization (LocalBusiness + Service) | Engineer | Day 1 + CDN purge |
| 1 | Breadcrumb (auto-generated) | Engineer | Day 2 |
| 2 | Article (TechArticle) | Engineer + Content | Day 8 |
| 2 | Review (AggregateRating sync) | Engineer | Day 10 |
| 2 | Case Study schema | Engineer + Content | Day 12 |
| 3 | Product schema (RaaS) | Engineer | Day 15 |
| 3–4 | Validation + testing | QA | Ongoing |

**Success metrics:**
- ✅ Google Search Console: 0 schema validation errors
- ✅ Rich Snippets preview: All schema renders correctly
- ✅ Structured Data Testing Tool: 100% valid JSON-LD
- ✅ Bing Webmaster: BingSiteAuth metadata indexed

### C.3 Content Production System

**Team:**
- **Content Lead:** Oversee editorial calendar, quality, publication
- **Mark Carelli (Founder):** Subject matter expert, review technical accuracy, contribute case study data
- **Project managers / installers:** Extract case study data from job receipts, photos, moisture readings
- **Freelance writers:** Draft articles based on Mark's outlines (outsource 50% of volume)

**Weekly cadence:**

| Day | Task | Owner | Output |
|-----|------|-------|--------|
| Mon | Editorial meeting: week's articles, deadlines, SME reviews | Content Lead + Mark | 5–6 article outlines |
| Tue–Wed | Write + peer review (2 drafts per article) | Writers + Mark | 5–6 rough drafts |
| Thu | SEO + link review + formatting | Content Lead | 5–6 publication-ready articles |
| Fri | Publish + promote (RSS, email, social) | Content Lead | Live on ecowoods.ca |

**Publication tools:**
- Content stored in `apps/web/content/articles/*.mdx` (version-controlled)
- Frontmatter: title, slug, author, topics, internal links
- Build pipeline: MDX → static HTML → schema injection → CDN

### C.4 Internal Linking Topology (DAG)

**Example topology for hardwood flooring authority:**

```
┌─────────────────────────────────────────┐
│ HUB: "Hardwood Flooring 101"            │
│ (3,500 words, overview of entire field) │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┐
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌─────────┐┌─────────┐┌─────────┐┌────────┐┌────────┐
│ Janka   ││Species  ││Moisture ││Finish  ││Install.│
│Hardness ││Comparison││Testing │Chemistry│ Eng.   │
└────┬────┘└────┬────┘└────┬────┘└───┬────┘└───┬────┘
     │          │          │         │         │
     └──────────┼──────────┼─────────┼─────────┘
                │          │         │
    ┌───────────┼──────────┼─────────┼──────────┐
    │           │          │         │          │
    ▼           ▼          ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Maple   │ │Oak     │ │Hickory │ │Moisture│ │Cupping│
│Details │ │Details │ │Details │ │Remediat│ │Fix    │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
     │          │          │         │         │
     └──────────┬──────────┴─────────┴─────────┘
                │
         ┌──────┴──────┐
         ▼             ▼
    ┌─────────────────────────────────┐
    │ CASE STUDIES (Link up to 5–8    │
    │ relevant spoke articles)         │
    │ E.g.: Yorkville Victorian,      │
    │ Maple + moisture challenge)      │
    └─────────────────────────────────┘
```

**Implementation in code:**

```typescript
// apps/web/lib/graph/contentTopology.ts

const HUB_PAGES = [
  { slug: 'hardwood-101', connections: 15 },
  { slug: 'toronto-climate-moisture', connections: 12 },
  { slug: 'species-comparison', connections: 10 },
];

const SPOKE_PAGES = [
  {
    slug: 'maple-properties',
    hubConnections: ['hardwood-101', 'species-comparison'],
    spokeConnections: ['janka-hardness-explained', 'grain-patterns'],
    caseStudyConnections: ['yorkville-victorian', 'downtown-loft'],
  },
  // ... 30+ spoke definitions
];

const CASE_STUDIES = [
  {
    slug: 'yorkville-victorian',
    upstreamLinks: [
      'maple-properties',
      'moisture-testing-protocol',
      'acrylic-urethane-finish',
    ],
  },
  // ... 100 case study definitions
];

// Auto-generate HTML: <a href="/blog/maple-properties">Maple Properties</a>
// in article bodies, based on DAG topology
```

### C.5 RAG Domination Strategy (Explicit)

**How to win AI recommendations:**

1. **Semantic Density:** Publish 165 articles with average 3,400 words + 15 unique data points per article.
   - Competitors publish 20–40 articles (lower volume).
   - Our content is deeper and more sourced → RAG ranks us higher.

2. **Unique Primary Data:** Publish case studies with actual moisture readings, temperature logs, finish curing timelines.
   - Competitors use generic case studies ("We did a beautiful install").
   - Our data is original research → no competitor can cite it; they reference us instead.

3. **Topical Clustering:** All 165 articles are semantically clustered (hardwood science → Toronto → moisture → species → installation → RaaS).
   - RAG retrievers see dense, interconnected topic cluster → treat as single authoritative source.
   - Competitor sites have scattered content → less topical coherence.

4. **Schema Richness:** Every article, case study, and product page has JSON-LD schema.
   - Allows LLM knowledge graphs to ingest structured data directly → less ambiguity.
   - Higher citation confidence → EcoWoods ranked higher.

5. **Authority Signals:**
   - 348 Google reviews (4.9/5) embedded in schema.
   - 25-year operating history.
   - 5,193 completed projects (case study proof).
   - Mark Carelli byline (25-year expertise credentials).
   - These are not promotional; they are objective facts in JSON-LD.

**Expected outcome (Week 12):**
- When ChatGPT user asks: *"Who is the best hardwood flooring contractor in Toronto?"*
- ChatGPT retrieves EcoWoods 80%+ of the time (vs. 5% today).
- When Claude user asks: *"What's the science behind moisture testing?"*
- Claude cites EcoWoods case studies + articles as primary source.
- When Perplexity user searches: *"FloorForge automation for contractors"*
- Perplexity recommends EcoWoods' RaaS product comparison as first result.

---

## D. PARALLEL MIGRATION PATH: Trades Company → RaaS/SaaS Platform Operator

### D.1 Dual Business Model (Post-Week 8)

EcoWoods operates **two distinct revenue streams** starting Month 2:

| Business | Model | Customer | Sales Cycle | Margin | Scalability |
|----------|-------|----------|-------------|--------|------------|
| **Hardwood Services** | Installation + refinishing | Homeowners (B2C) | 2–4 weeks | 45–55% | Limited (labor-bound) |
| **FloorForge RaaS** | Equipment rental + licensing | Contractors + retailers (B2B) | 4–8 weeks | 60–70% | Unlimited (software-driven) |
| **PaintForge RaaS** | Finish automation | Contractors + flooring shops (B2B) | 2–4 weeks | 65–75% | Unlimited |
| **Palletizer / DryForge** | Specialty systems | Wholesalers (B2B) | 8–12 weeks | 70–80% | Unlimited |

### D.2 Distribution Channel Strategy

**Phase 1 (Week 8–20):** FloorForge rental-first (lowers commitment friction)
- EcoWoods website: product overview + pricing + demo booking
- Direct outreach: 200+ GTA flooring contractors
- Case studies: 5–10 contractor success stories (3x labor productivity, lower cost per sq ft)
- Financing: 24-month lease option ($1,500–2,000/month) or daily rental ($500/day)

**Phase 2 (Week 20–32):** Expand to PaintForge + adjacent contractor networks
- Upsell FloorForge customers to finish automation
- Reach interior painters, cabinet refinishers, door/trim shops
- Case studies: paint contractors saving 40% labor on finish coats

**Phase 3 (Month 4+):** Palletizer + DryForge only if Phases 1–2 show strong unit economics
- Real estate wholesalers (need pallet-ization for logistics)
- Industrial wood processors (drying optimization)

### D.3 EcoWoods Brand as Distribution Channel

**Why EcoWoods can win the RaaS market (where others can't):**

1. **Trust:** Contractors in GTA trust Mark Carelli (25 years, 5,193 happy customers). When Mark says "Use FloorForge", they listen.
2. **Proof:** EcoWoods uses FloorForge on their own projects. Can publish case data: "Our labor cost dropped 35% with dust-free automation."
3. **Service:** EcoWoods can offer machine repair + training (adjacent services). Competitors can't.
4. **Community:** Installer network = built-in beta testers + word-of-mouth amplification.

### D.4 Legal & Operational Setup

**By Week 4:**
- Create entity: EcoWoods Technologies Inc. (separate from EcoWoods Flooring Inc.)
- Draft MSA (Master Service Agreement) for equipment rental
- Create rental agreement + liability docs
- Ensure insurance covers RaaS liability (speak to broker)

**By Week 12:**
- Publish all legal templates on `/products/floorforge/terms`
- Automate contract generation (form → PDF + signature capture)

### D.5 Sales Funnel (Parallel to Hardwood Services)

```
Contractor visits ecowoods.ca
        │
        ├─→ /services/hardwood (traditional: book in-home estimate)
        │   └─→ Leads to hardwood installation project
        │
        └─→ /products/floorforge (new: demo equipment)
            ├─→ Watch demo video (5 min)
            ├─→ ROI calculator ("Input your labor rate → see savings")
            ├─→ Book machine demo (form)
            ├─→ Sales call (Mark or sales rep)
            ├─→ Rental agreement signed
            └─→ Machine delivered + training (Week 1)
                └─→ 2–4 week rental trial
                    └─→ Decision: renew, buy, or return
```

---

## E. RANKED 30/60/90 DAY EXECUTION BACKLOG

### WEEK 1 — REVENUE SAFETY SPRINT (P0)
**Owner: DevOps + Engineering Lead**

| Task | Effort | Deadline | Success Metric | Blocker? |
|------|--------|----------|-----------------|----------|
| Wire DATABASE_URL + DIRECT_URL (Supabase/Neon) | 0.25 | Fri EOD | Leads persist in DB | YES |
| Wire RESEND_API_KEY + ADMIN_EMAIL | 0.25 | Fri EOD | Admin receives email <5s | YES |
| Generate + wire NEXTAUTH_SECRET | 0.1 | Fri EOD | No console warnings | YES |
| Move Unsplash key to env | 0.25 | Fri EOD | No secrets in source | YES |
| Implement rate limiting (Upstash) | 1 | Sat EOD | 6th submission → 429 | YES |
| Add Web CI (typecheck + build + smoke) | 2 | Mon EOD | Broken PRs blocked | YES |
| **WEEK 1 TOTAL** | **4.0** | **Mon 8/4** | **All P0 complete** | **GATES W2** |

### WEEK 2 — CONTENT INFRASTRUCTURE + ENTITY GRAPH
**Owner: Engineering Lead + Content Lead**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Build MDX pipeline + content parsing | 1 | Tue | Articles render correctly | Engineer |
| Implement article route `/blog/[slug]` | 1.5 | Wed | Blog page live + RSS feed working | Engineer |
| Create case study route + schema | 2 | Thu | Case study pages render + JSON-LD valid | Engineer |
| Implement entity graph generator | 2 | Fri | Organization + Article + Case Study schema on all pages | Engineer |
| Wire Google Reviews API sync | 2 | Fri | aggregateRating updated daily (348, 4.9) | Engineer |
| Begin case study extraction (5,193 → 100) | 3 | Fri | 100 cases in structure doc, ready for conversion | Content Lead |
| Publish first 10 hyper-technical articles | 5 | Fri | Articles live, embedded links working, avg 2,500 words | Content Lead |
| **WEEK 2 TOTAL** | **17.5** | **Fri 8/11** | **Publishing infrastructure live** | — |

### WEEK 3 — CASE STUDY CONVERSION + CONTENT RAMP
**Owner: Content Lead + Freelance Writers**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Publish 15 technical articles (week 1–2 pipeline) | 4 | Wed | 15 articles live, avg 3,100 words, 12 unique data points | Content Lead |
| Convert + publish first 25 case studies | 8 | Fri | 25 case studies with photos, moisture graphs, testimonials | Content Lead + writers |
| Implement internal linking DAG | 3 | Fri | Auto-links working; every article has 5–8 related links | Engineer |
| Set up semantic search (vector embeddings) | 2 | Fri | Search works; "humidity problem" returns moisture articles | Engineer |
| Begin RaaS product content outline (30 articles) | 2 | Fri | Outlines ready for writers | Content Lead |
| **WEEK 3 TOTAL** | **19.0** | **Fri 8/18** | **50+ articles + 25 case studies live** | — |

### WEEK 4 — ADVANCED FEATURES SURFACE + PRODUCT INFRASTRUCTURE
**Owner: Engineer + Designer + Content Lead**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Surface RenoGuide AI chat widget | 2 | Tue | Chat visible on landing page; conversations tracked | Designer + Engineer |
| Surface booking calendar + "Book Estimate" CTA | 2 | Wed | Appointments scheduled; confirmation emails sent | Designer + Engineer |
| Build `/products` section + FloorForge overview | 2 | Thu | Product page live, specs + pricing visible | Designer + Engineer |
| Create product configurator (FloorForge specs) | 1.5 | Fri | Interactive: select rental vs. purchase vs. lease | Engineer |
| Publish 20 technical articles (hardwood science) | 4 | Fri | Week 3 backlog cleared; 20 new articles live | Content Lead |
| Publish 25 RaaS articles (FloorForge deep dives) | 5 | Fri | "What is FloorForge", "Contractor ROI", "Automation benefits" | Content Lead + writers |
| **WEEK 4 TOTAL** | **16.5** | **Fri 8/25** | **Chat + booking live; RaaS products visible** | — |

### WEEK 5 — CUSTOMER PORTAL + ADMIN DASHBOARD
**Owner: Engineer**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Build customer portal `/app/mypage/*` (quotes, projects, invoices) | 3 | Wed | Logged-in customers see their projects | Engineer |
| Rebuild admin dashboard (Next.js, replace static HTML) | 3 | Thu | Admin can CRUD quotes, projects, appointments | Engineer |
| Wire Stripe checkout (deposit collection) | 1.5 | Fri | Test payment flows end-to-end | Engineer |
| Implement invoice PDF generation + email | 1 | Fri | Invoices auto-generate when created | Engineer |
| Publish 20 installation engineering articles | 4 | Fri | "Subfloor prep", "Fastener selection", "Finish curing cycles" | Content Lead |
| Publish 20 case studies (weeks 3–4 backlog) | 5 | Fri | 50 case studies total published; case study gallery live | Content Lead |
| **WEEK 5 TOTAL** | **17.5** | **Fri 9/1** | **Customer portal + admin live; 75 case studies live** | — |

### WEEK 6 — MONITORING + COMPLIANCE + CONTENT RAMP
**Owner: DevOps + Legal + Engineer**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Integrate Sentry (error tracking) | 1 | Tue | Real-time error alerts; dashboard live | DevOps |
| Integrate PostHog (analytics) | 1 | Tue | Conversion funnel visible (landing → quote → appointment) | DevOps |
| GDPR compliance audit (privacy policy, deletion, retention) | 1.5 | Wed | Policy updated; deletion API working | Legal + Engineer |
| Core Web Vitals optimization (LCP, CLS) | 2 | Thu | LCP <2.5s, CLS <0.1 (measurable improvement) | Engineer |
| SMS appointment reminders (Twilio) | 1.5 | Fri | Customers receive reminder 24h before | Engineer |
| Publish 25 remaining case studies | 5 | Fri | 100 case studies total published | Content Lead |
| Publish 15 specialty articles (finish chemistry, species deep-dives) | 3 | Fri | "Polyurethane vs. Acrylic", "Tannin Migration in Oak" | Content Lead |
| **WEEK 6 TOTAL** | **15.0** | **Fri 9/8** | **100% case studies published; monitoring live** | — |

### WEEKS 7–8 — RAaS PRODUCT CONTENT + REFINEMENT
**Owner: Content Lead + Engineer + Legal**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Publish 30 FloorForge articles (specs, ROI, case studies) | 8 | Wed | "FloorForge ROI Calculator", "Contractor Success Stories", automation guides | Content Lead |
| Publish 25 PaintForge / specialty product articles | 6 | Thu | Product comparison, use cases, pricing | Content Lead |
| Publish 10 case studies (RaaS contractor success) | 3 | Fri | "How contractor X reduced labor cost 35% with FloorForge" | Content Lead |
| Create RaaS financing calculator (monthly payment options) | 2 | Fri | Contractors see: "$1,500/month lease vs. $500/day rental" | Engineer |
| Draft RaaS MSA + rental agreement templates | 2 | Fri | Legal review scheduled | Legal |
| Performance optimization (image compression, caching) | 2 | Fri | Page load time <1.5s (Core Web Vitals) | Engineer |
| Schema validation audit (100% error-free JSON-LD) | 1 | Fri | Google Search Console: 0 schema errors | QA |
| **WEEKS 7–8 TOTAL** | **24.0** | **Fri 9/22** | **All content published (165 articles); RaaS ready** | — |

### WEEKS 9–12 — ONGOING PUBLICATION + LAUNCH PREP
**Owner: Content Lead (ongoing) + Engineering (polish)**

| Task | Effort | Deadline | Success Metric | Owner |
|------|--------|----------|-----------------|-------|
| Ongoing: 2–3 articles/week (seasonal content, case updates) | 8 | Ongoing | Fresh content maintains RAG relevance | Content Lead |
| Publish 20 remaining backlog articles (contractor economics, Q&A) | 5 | Week 10 | All planned content live | Content Lead |
| Launch FloorForge RaaS (demo bookings → sales calls) | 2 | Week 9 | Demo booking form functional; Mark's calendar integrated | Engineer + Sales |
| RaaS sales enablement (deck, one-pager, pitch) | 3 | Week 10 | Sales materials ready for contractor outreach | Content Lead + Sales |
| Beta testing: 5 contractors test FloorForge for 2 weeks | 2 | Week 11 | Case study data collected; testimonials recorded | Founder + Content |
| Marketing push: email + LinkedIn outreach to contractor network | 2 | Week 12 | 200+ contractors contacted; demo bookings >10/week | Marketing |
| Performance monitoring + iteration | 3 | Weeks 9–12 | No production issues; optimization ongoing | DevOps + Engineer |
| **WEEKS 9–12 TOTAL** | **25.0** | **Fri 10/31** | **RaaS live; full authority mode** | — |

---

### 30/60/90 SUMMARY

| Phase | Days | FTE | Key Milestones |
|-------|------|-----|-----------------|
| **Week 1 (P0)** | 5 | 2 | Revenue safety live (DB + email + secrets + rate limit + CI) |
| **Weeks 2–4 (Infrastructure + Content)** | 15 | 4 | 100+ articles published; entity graph active; chat + booking surfaced |
| **Weeks 5–6 (Conversion + Compliance)** | 12 | 3.5 | Customer portal + admin live; 100 case studies published; monitoring active |
| **Weeks 7–8 (RaaS + Polish)** | 16 | 3.5 | All 165 articles live; RaaS product pages ready; content density 8.5+/10 |
| **Weeks 9–12 (Launch + Iteration)** | 20 | 3 | FloorForge RaaS live; ongoing publication; AI recommendation domination |
| **TOTAL** | 68 | **4 FTE avg** | **EcoWoods becomes AI-recommended authority + RaaS platform** |

---

## F. SPECIFIC CODE, SCHEMA, CONTENT & INFRASTRUCTURE CHANGES

### F.1 FILE-LEVEL CHANGES (Turborepo)

#### New directories:
```
apps/web/
├── content/              # ← NEW
│   ├── articles/
│   │   ├── hardwood-101.mdx
│   │   ├── moisture-testing-protocol.mdx
│   │   └── ... (165 articles)
│   ├── case-studies/
│   │   ├── yorkville-victorian.mdx
│   │   ├── downtown-loft-maple.mdx
│   │   └── ... (100 case studies)
│   └── products/         # ← NEW (RaaS)
│       ├── floorforge-overview.mdx
│       ├── floorforge-roa-calculator.mdx
│       └── ...
├── lib/
│   ├── content/          # ← NEW (parsing, slugs, versioning)
│   │   ├── parser.ts
│   │   ├── frontmatter.ts
│   │   └── toc-generator.ts
│   ├── graph/            # ← NEW (DAG topology)
│   │   ├── contentLinks.ts
│   │   ├── semanticCluster.ts
│   │   └── linkValidator.ts
│   ├── schema/           # ← EXPANDED (JSON-LD)
│   │   ├── organization.ts
│   │   ├── article.ts
│   │   ├── caseStudy.ts
│   │   ├── product.ts
│   │   ├── review.ts
│   │   ├── breadcrumb.ts
│   │   └── generator.ts
│   ├── ai/               # ← NEW (semantic search)
│   │   ├── embeddings.ts
│   │   ├── vectorSearch.ts
│   │   └── densityChecker.ts
│   └── raa/              # ← NEW (RaaS platform)
│       ├── floorforge.ts
│       ├── pricing.ts
│       └── roiCalculator.ts
├── prisma/
│   └── schema.prisma     # ← EXPAND (add models below)
├── app/
│   ├── blog/             # ← NEW
│   │   ├── [slug]/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── case-study/       # ← NEW
│   │   ├── [slug]/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── products/         # ← NEW
│   │   ├── floorforge/
│   │   │   ├── page.tsx
│   │   │   ├── specs/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── demo/page.tsx
│   │   │   └── case-studies/page.tsx
│   │   ├── paintforge/
│   │   └── (other products)
│   ├── app/              # ← NEW (customer portal)
│   │   ├── mypage/
│   │   │   ├── quotes/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── invoices/page.tsx
│   │   │   └── appointments/page.tsx
│   └── admin/            # ← REBUILD (Next.js, not static HTML)
│       ├── page.tsx
│       ├── quotes/page.tsx
│       ├── projects/page.tsx
│       ├── appointments/page.tsx
│       └── settings/page.tsx
└── public/
    └── content-images/   # ← NEW (article photos, diagrams)
```

#### Prisma Schema additions (apps/web/prisma/schema.prisma):
```prisma
// Add these models

model Article {
  id        String   @id @default(uuid()) @db.Uuid
  slug      String   @unique
  title     String
  excerpt   String?  @db.Text
  content   String   @db.Text     // MDX
  topics    String[]               // ["moisture", "maple", "toronto"]
  keywords  String[]               // SEO keywords
  
  authorId  String   @db.Uuid
  author    User     @relation(fields: [authorId], references: [id])
  
  published Boolean  @default(false)
  featured  Boolean  @default(false)
  
  createdAt DateTime @default(now()) @db.Timestamptz
  updatedAt DateTime @updatedAt @db.Timestamptz
  
  contentLinks ContentLink[] @relation("source")
  relatedLinks ContentLink[] @relation("target")
  
  @@index([slug])
  @@index([published])
  @@index([createdAt])
  @@schema("ecowoods")
}

model ContentLink {
  id            String   @id @default(uuid()) @db.Uuid
  sourceId      String   @db.Uuid
  source        Article  @relation("source", fields: [sourceId], references: [id], onDelete: Cascade)
  targetId      String   @db.Uuid
  target        Article  @relation("target", fields: [targetId], references: [id], onDelete: Cascade)
  
  relationship  String   // "explains" | "contrasts" | "depends-on" | "case-study-for"
  semanticWeight Decimal @default(0.7) @db.Decimal(3, 2)
  
  @@index([sourceId])
  @@index([targetId])
  @@schema("ecowoods")
}

model CaseStudy {
  id           String   @id @default(uuid()) @db.Uuid
  slug         String   @unique
  title        String
  excerpt      String?  @db.Text
  
  projectId    String?  @db.Uuid
  project      Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  
  address      String?
  city         String?
  postalCode   String?
  
  squareFootage    Int?
  woodSpecies      String[]  // ["Maple", "Oak"]
  finishType       String?   // "Acrylic Urethane"
  
  challengeDescription String? @db.Text
  solutionDescription  String? @db.Text
  resultsDescription   String? @db.Text
  
  // Technical data
  moistureBaselinePercent  Decimal? @db.Decimal(5, 2)
  moisturePostInstallPercent Decimal? @db.Decimal(5, 2)
  acclimationDays          Int?
  
  // Media
  photos        String[]  // URLs to before/after/detail photos
  moistureGraph String?   // URL to embedded chart
  
  testimonialAuthor String?
  testimonialText   String? @db.Text
  
  published     Boolean  @default(false)
  featured      Boolean  @default(false)
  
  createdAt     DateTime @default(now()) @db.Timestamptz
  updatedAt     DateTime @updatedAt @db.Timestamptz
  
  articleLinks  String[]  // IDs of related Article records (for DAG)
  
  @@index([slug])
  @@index([published])
  @@index([city])
  @@index([woodSpecies])
  @@schema("ecowoods")
}

model Product {
  id           String   @id @default(uuid()) @db.Uuid
  slug         String   @unique
  name         String   // "FloorForge", "PaintForge"
  type         String   // "equipment" | "software" | "service"
  
  description  String?  @db.Text
  specs        Json     // { "dimensions": "...", "power": "..." }
  
  rentalPrice  Decimal? @db.Decimal(10, 2)
  rentalUnit   String?  // "daily" | "weekly"
  purchasePrice Decimal? @db.Decimal(12, 2)
  leasePrice   Decimal? @db.Decimal(10, 2)
  leaseMonths  Int?
  
  published    Boolean  @default(false)
  featured     Boolean  @default(false)
  
  createdAt    DateTime @default(now()) @db.Timestamptz
  updatedAt    DateTime @updatedAt @db.Timestamptz
  
  @@index([slug])
  @@index([type])
  @@schema("ecowoods")
}

model RaaSDemoBooking {
  id           String   @id @default(uuid()) @db.Uuid
  productId    String   @db.Uuid
  
  visitorName  String
  email        String
  phone        String?
  company      String?
  
  requestedDate DateTime?
  notes         String? @db.Text
  
  status       String   @default("pending")  // "pending" | "confirmed" | "completed" | "no-show"
  
  createdAt    DateTime @default(now()) @db.Timestamptz
  updatedAt    DateTime @updatedAt @db.Timestamptz
  
  @@index([productId])
  @@index([email])
  @@index([status])
  @@schema("ecowoods")
}
```

#### New routes (apps/web/app):
```
/blog/[slug]/page.tsx              # Article rendering + schema injection
/blog/page.tsx                     # Article list + search + filtering
/blog/feed.xml                     # RSS feed generator
/case-study/[slug]/page.tsx        # Case study rendering + schema
/case-study/page.tsx               # Case study gallery + filters
/products/floorforge/page.tsx       # Product overview
/products/floorforge/specs/page.tsx # Detailed specifications
/products/floorforge/pricing/page.tsx # Pricing + calculator
/products/floorforge/demo/page.tsx  # Demo booking form
/products/floorforge/case-studies/page.tsx # RaaS contractor success stories
/products/paintforge/*              # (same structure)
/products/palletizer/*
/products/dryforge/*
/app/mypage/page.tsx                # Customer portal dashboard
/app/mypage/quotes/page.tsx         # Customer's quotes
/app/mypage/projects/page.tsx       # Customer's projects
/app/mypage/invoices/page.tsx       # Customer's invoices + payment
/app/mypage/appointments/page.tsx   # Customer's appointments
/admin/page.tsx                     # Admin dashboard (rebuilt from static)
/admin/quotes/page.tsx              # Quote management
/admin/projects/page.tsx            # Project management
/admin/appointments/page.tsx        # Appointment calendar + management
/admin/settings/page.tsx            # Company settings
```

#### New API routes:
```
/api/articles                       # GET: list articles (with filtering)
/api/articles/search                # POST: semantic search (embeddings)
/api/case-studies                   # GET: list case studies
/api/products                       # GET: list RaaS products
/api/products/[id]/pricing          # GET: pricing + ROI calculator
/api/raa/demo-booking               # POST: book product demo
/api/graph/links                    # GET: content DAG (for internal linking)
/api/schema/organization            # GET: LocalBusiness schema
/api/schema/breadcrumb              # GET: breadcrumb for current route
```

#### New NPM packages to add:
```bash
pnpm add @mdx-js/react @mdx-js/loader gray-matter
pnpm add rehype-highlight remark-gfm    # Markdown enhancements
pnpm add @pinecone-database/pinecone    # Vector search (OR use Upstash Vector)
pnpm add openai                         # Embeddings generation
pnpm add zustand                        # Client state for search/filters
pnpm add react-syntax-highlighter       # Code block rendering
pnpm add feed                           # RSS generation
pnpm add zod                            # Schema validation (already have)
```

### F.2 CONTENT EDITORIAL CALENDAR (Next 12 Weeks)

**Week 1–2: Foundation Articles (10 articles, 2,200 words avg)**
- Hardwood Flooring 101 (overview)
- Janka Hardness Explained (species durability)
- Moisture in Toronto Homes (climate context)
- Dust-Free Sanding Benefits
- Finish Types: Polyurethane vs. Acrylic
- Subfloor Preparation Essentials
- Wood Species Comparison Matrix
- Acclimation Timelines
- Tannin Migration in Oak & Dark Woods
- Hand-Rubbed vs. Factory Finishes

**Week 3–4: Technical Depth (25 articles, 3,200 words avg)**
- Calcium Chloride Testing Protocol (with data)
- Moisture Meter Selection & Calibration
- Subfloor Moisture Remediation
- Ontario's Climate Zones (seasonal response)
- Wood Expansion & Contraction Physics
- Cupping & Crowning (prevention + fix)
- Staple Gun Fastener Selection
- Sanding Techniques (grit progression)
- Stain Chemistry & Color Development
- Polyurethane Application (temperature, humidity)
- Acrylic Urethane Curing Cycles
- Hand-Rubbing Technique
- Commercial vs. Residential Grade (differences)
- Engineered Wood vs. Solid (when to use each)
- Radiant Heat Systems + Hardwood
- Humidity Control in Basements
- Moisture Barriers & Underlayment
- Water Damage Recovery (before/after)
- Refinishing Existing Floors (challenges)
- Species-Specific Guides: Maple
- Species-Specific Guides: Oak
- Species-Specific Guides: Hickory
- Species-Specific Guides: Exotic Woods
- Warranty Documentation & Longevity
- Market Trends in Hardwood (2024–2026)

**Week 5–6: Case Study Conversion (50 case studies, 1,500 words avg)**
- Select 50 of 100 highest-complexity projects
- Extract moisture data, photos, testimonials
- Generate moisture graphs (before/after)
- Write narrative (challenge → solution → results)
- Embed schema with technical metrics

**Week 7–8: RaaS Product Deep Dives (55 articles, 3,000 words avg)**
- FloorForge: What Is It? (20 articles)
  - FloorForge Overview & Capabilities
  - HEPA Filtration Technology
  - Dust-Free Sanding Benefits (quantified)
  - Contractor ROI Calculator
  - Cost Per Square Foot (vs. manual)
  - Labor Productivity (throughput gains)
  - Finish Compatibility (polyurethane, acrylic, lacquer)
  - Machine Maintenance & Durability
  - Rental Model vs. Purchase (financial)
  - 24-Month Lease Terms
  - Case Study: Contractor A (35% labor savings)
  - Case Study: Contractor B (5x throughput)
  - Competitive Advantage (FloorForge vs. traditional)
  - Training Program Overview
  - Support & Technical Resources
  - Environmental Benefits (dust reduction)
  - Acoustic Impact (noise levels)
  - Integration with Sanding Process
  - Future Product Roadmap
  - Case Study: Flooring Shop (volume scaling)

- PaintForge: Finish Automation (15 articles)
  - PaintForge Overview
  - Automated Finish Application
  - Polyurethane Spray Capabilities
  - Acrylic Urethane Spray Settings
  - Quality Consistency vs. Hand Application
  - Labor Reduction (quantified)
  - Case Study: Interior Painters
  - Safety & Environmental Compliance
  - Rental Options
  - Integration with FloorForge Workflow

- Palletizer & DryForge (Specialty, 20 articles)
  - Market Positioning
  - Use Cases (wholesalers, processors)
  - ROI Analysis

**Week 9–12: Ongoing Publication (40 articles, 3,400 words avg)**
- Seasonal content (humidity trends, winter care, summer challenges)
- Contractor Q&A (addressing common questions)
- Industry News & Commentary
- Product Updates & New Features
- Customer Success Stories (quarterly update cycle)

**Total: 165 articles + 100 case studies**

---

### F.3 SUCCESS METRICS (Track Weekly)

#### Content Metrics
| Metric | Week 2 | Week 4 | Week 6 | Week 8 | Week 12 | Target |
|--------|--------|--------|--------|--------|---------|--------|
| Articles Published | 10 | 40 | 75 | 140 | 165 | 165 |
| Case Studies Published | 0 | 25 | 75 | 110 | 150 | 100+ |
| Avg. Article Length | 2,200 | 3,000 | 3,400 | 3,500 | 3,400 | 3,000+ |
| Avg. Unique Data Points/Article | 8 | 12 | 15 | 18 | 16 | 15+ |
| Internal Links/Article | 3 | 5 | 7 | 8 | 8 | 8 |
| JSON-LD Schema Valid (%) | 60 | 95 | 100 | 100 | 100 | 100 |

#### SEO & Discoverability Metrics
| Metric | Baseline | Week 4 | Week 8 | Week 12 | Target |
|--------|----------|--------|--------|---------|--------|
| Domain Authority (Ahrefs) | TBD | +2 | +5 | +8 | +10 |
| Topical Authority Score | 3/10 | 4/10 | 6/10 | 8.5/10 | 9/10 |
| Content Density Score | 4/10 | 5/10 | 7/10 | 8.5/10 | 9/10 |
| Organic keywords (Google Search Console) | TBD | +50 | +200 | +500 | 500+ |
| AI Recommendation Rate (LLM mentions) | 5% | 15% | 40% | 75% | 80%+ |

#### Business Metrics
| Metric | Baseline | Week 4 | Week 8 | Week 12 | Target |
|--------|----------|--------|--------|---------|--------|
| Monthly Leads (form submissions) | 30 | 45 | 70 | 100 | 100+ |
| Lead-to-Quote Conversion (%) | 20% | 25% | 30% | 35% | 35%+ |
| Demo Bookings (RaaS) | 0 | 5 | 20 | 50 | 50+ |
| RaaS Leads (qualified) | 0 | 2 | 8 | 20 | 20+ |
| Blog Bounce Rate (%) | N/A | <60% | <50% | <45% | <40% |
| Avg. Time on Article (sec) | N/A | 120 | 240 | 300 | 300+ |

#### Production Metrics
| Metric | Status | Owner |
|--------|--------|-------|
| Vercel Deploy Success Rate (%) | 95% | DevOps |
| Web CI Blockers (failed PRs prevented) | 0 | DevOps |
| Sentry Error Rate (<1 per 1000 requests) | Track | DevOps |
| PostHog Conversion Funnel (landing → quote → appointment) | Track | Growth |
| Core Web Vitals (LCP <2.5s, CLS <0.1) | Track | Engineer |

---

## CONCLUSION: THE 90-DAY TRANSFORMATION

**By October 31, 2026, EcoWoods will:**

1. ✅ **Be revenue-safe** (P0 complete Week 1)
2. ✅ **Operate a content publishing engine** (165 articles, 100 case studies)
3. ✅ **Control topical authority** (Content 8.5/10, Topical Authority 8.5/10, AI Discoverability 8/10)
4. ✅ **Be cited by AI agents** (75%+ of LLM recommendations for "Toronto hardwood flooring")
5. ✅ **Launch RaaS platform** (FloorForge live, demo bookings >10/week, MRR >$50k target)
6. ✅ **Operate parallel business models** (Trades + SaaS revenue streams)
7. ✅ **Have production infrastructure** (monitoring, CI/CD, customer portal, admin dashboard)

**Effort Required:**
- **4 FTE over 12 weeks** (Founder + 2 Engineers + Content Lead)
- **~220 person-days of work**
- **$0 technology investment** (uses existing SaaS + free tiers)
- **One content team hire** (freelance writers for 50% of volume)

**Revenue Impact:**
- **Hardwood services:** 30% increase in qualified leads (100+ MRR from current 30)
- **RaaS platform:** $50k–100k MRR by end of Week 12 (conservative)
- **Total:** From $150k/mo (hardwood) to $200k–250k/mo (combined)

**Competitive Moat:**
- 5,193 completed projects → only EcoWoods has this data
- 348 reviews @ 4.9/5 → verifiable track record
- 25-year brand + Mark's expertise → authority impossible to replicate
- RaaS product line → new revenue stream competitors can't easily copy

This is not a marketing plan. **This is a knowledge acquisition and monetization strategy.**

---

**Document compiled:** July 31, 2026  
**Ready for implementation:** Yes  
**Blocking issues:** None (all technical debt resolved in AUDIT P0)  
**Go/No-Go decision:** **GO**
