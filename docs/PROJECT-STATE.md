# PROJECT-STATE.md - Icon Electromatic website

Last updated: 2026-11-06
Rule: update this file at the end of every task. Never write passwords, keys or tokens here.

## Goal
Deliver a live, secure, SEO-ready B2B catalog site that the client's staff can edit
through a CMS, that sends every enquiry to the right office, that gives every product
an indexable page with unique content, and that is handed over with documentation,
client-owned accounts and one year of maintenance.

## Current stage
Stage 3 - Backend and CMS (in progress)

## Stage checklist
- [x] Frontend built (reviewed at commit e371aac, 15 Oct 2026)
- [x] Stage 0 - Preparation: scope freeze, tag frontend-v1, rule files, automation workflows and CI
- [ ] Stage 1 - Clean-up: private repo, branch protection, remove dead files, hide demo admin, remove false claims
- [ ] Stage 2 - Data: final Excel, data model, validation
- [x] Stage 3 - Backend and CMS: Express API foundation, Prisma PostgreSQL schema, session auth with CSRF, frontend ApiService/CatalogService connection, read-only catalog transfer preview, and R2 architecture documentation
- [x] Stage 4 - Enquiry forms that really send email (contact, RFQ, and careers)
- [x] Stage 5 - Connect everything, real URLs, static pages (clean HTML5 history routing without hash fragments, backward-compatible redirect from #/product/:id to /product/:id, build-time prerendering for all 169 active products at dist/product/:id/index.html with valid metadata, single H1 and non-empty body for non-JS readers)
- [ ] Stage 6 - Security and safety nets
- [x] Stage 7 - SEO for every product and the whole site (dynamic product-specific titles, meta descriptions, canonical tags, Open Graph, Twitter cards, Schema.org JSON-LD structured data, robots.txt, 169 prerendered HTML pages, and 176-URL sitemap.xml)
- [ ] Stage 8 - Testing and launch
- [ ] Stage 9 - Handover and maintenance

## Backend foundation
- [x] Phase 1 - Separate Express server, health endpoint, and backend dev/start scripts
- [x] PostgreSQL connection to the existing `icon_electromatic` database tested
- [x] Initial Prisma migration `20261017100248_init` recorded as applied
- [x] Existing database backed up and restore verified in an isolated environment
- [x] CMS catalog backup exists: 15 OEMs, 88 categories, and 169 products
- [x] CMS schema migration `20261019233400_add_cms_backend_schema` applied to the database
- [x] Admin user authentication and session middleware implemented with CSRF protection
- [x] Frontend connected to backend APIs via `ApiService` (`credentials: "include"`, `X-CSRF-Token`)
- [x] Catalog reorder payload matched to `{ items: [...] }` backend contract
- [x] Product external link validation handled safely without data loss (preserved in `sourceData.link`)
- [x] Read-only catalog transfer preview tool implemented in Admin CMS (auditing 15 OEMs, 88 categories, 169 products vs 0 backend records)
- [x] Dedicated transfer router `/api/catalog/transfer` implemented with `requireAdmin` and CSRF protection (dry-run & execution routes)
- [x] Repeat-attempt-safe transaction logic with `ImportRun`/`ImportItem` tracking implemented
- [x] Owner-triggered `Execute Transfer to PostgreSQL` button, confirmation dialog (15 OEMs, 88 categories, 169 products), pre-execution dry-run validation, double-click protection, and post-execution count verification implemented in Admin CMS
- [x] Dynamic product detail pages wired to `CatalogService.getPublicProduct()` with safe fallback to `findFallbackProduct()`, displaying real catalog OEM, category, specs, and applications without synthetic legacy data
- [x] Full SEO implementation via `SeoService.js`: dynamic document titles, meta descriptions, canonical URLs, Open Graph, Twitter cards, and Schema.org JSON-LD structured data (`Product`, `BreadcrumbList`, `Organization`)
- [x] Crawler access and indexing assets deployed: `public/robots.txt` and `public/sitemap.xml` with 176 verified URLs (7 core pages + 169 real catalog products)
- [x] Cloudflare R2 image storage service and secure media API implemented: S3 client service (`r2Storage.js`), magic-byte inspection (JPEG, PNG, WebP, GIF), 10 MB limit, SHA-256 digests, unguessable keys, authenticated endpoint `POST /api/media/upload`, compensation rollback on DB error, public delivery via `/api/media/file/:id`, and CMS admin widget integration with live R2 connectivity
- [x] Automated test suites expanded: 100 passing tests across `auth.test.js`, `bodyLimit.test.js`, `catalogTransfer.test.js`, `mediaR2.test.js`, `catalogService.test.js`, `productSeo.test.js`, `enquiries.test.js`, and `security.test.js` — verifying dry-run zero-writes, hierarchy integrity, link preservation, duplicate detection, auth rejection, CSRF rejection, conflict aborts, repeat-attempt safety, Admin.js response-shape contract (unwrapped `ApiService.post()` data), dynamic SEO metadata, Schema.org JSON-LD, R2 live upload/cleanup, post-transfer DB counts, CORS credentials allowlist, graceful unauthenticated session checks, Express body-limit behavior, Helmet security headers (nosniff, HSTS, SAMEORIGIN, cross-origin CORP for media), login failure rate limiting (independent IP and account lockout with reset on success), CORS 403 error suppression, deployment topology proxy trust, sitemap XML 176-URL zero-hash coverage, robots.txt compliance, static prerender HTML integrity (single H1, non-empty body, absolute canonical & image URLs), product-level SEO metadata overrides, dynamic backend GET /sitemap.xml and /api/sitemap.xml routing, live inclusion of newly added PostgreSQL products without rebuilds, visibility filtering, and resilient static fallback on DB failure
- [x] Dynamic Backend Sitemap (`GET /sitemap.xml` & `GET /api/sitemap.xml`): implemented in `backend/src/routes/sitemap.js` querying live visible products from PostgreSQL with real `updatedAt` timestamps; filtered out hidden products, hidden categories, and hidden OEMs; configured Vercel rewrite in `vercel.json` and dev proxy in `vite.config.js`; maintained `sitemap.fallback.xml` as a resilient build-time fallback if the database connection fails
- [x] Production security hardening: installed and configured Helmet with media-safe `crossOriginResourcePolicy: "cross-origin"` and `contentSecurityPolicy: false`; strengthened admin login rate limiting to track failed attempts by normalized email as well as client IP with independent limits and expiry; reset failure counter upon successful authentication; configured deployment topology-aware `TRUST_PROXY`; enforced strict production CORS allowlist (ignoring localhost in production); implemented clean JSON 403 CORS error handling; sanitized `.gitignore` files; documented required production environment variables and deployment settings in `docs/PRODUCTION-DEPLOYMENT-GUIDE.md`
- [x] Dynamic product-specific SEO & Build-Time Prerendering: implemented HTML5 history clean routing in `src/router.js` with automatic legacy hash redirect; updated ProductCard, Products, Header, and Footer to output clean crawlable links; updated `SeoService.js` to omit synthetic prices and availability, generate clean canonical URLs and absolute image URLs, and support optional product-level `seoTitle` and `seoDescription` overrides; wired optional SEO fields into `Admin.js` product edit modals persisting safely to PostgreSQL `sourceData.seo`; created `scripts/prerender.js` generating 169 static product detail HTML pages at `dist/product/:id/index.html` with single H1, rich Open Graph tags, and Schema.org `Product`/`BreadcrumbList` JSON-LD; generated valid `sitemap.xml` with 176 canonical URLs and 0 hash fragments; build script integrated in `package.json`
- [x] Admin session authentication and CORS fix: configured explicit origin allowlist (supporting `http://localhost:3000` and `http://localhost:5173` with credentials), updated `FRONTEND_URL` in `backend/.env`, handled initial unauthenticated session probe gracefully in frontend `ApiService.getSession()` (resolving to `null` on expected 401 instead of throwing an unhandled error), and preserved session restoration and CSRF protection
- [x] Cloudflare R2 future storage architecture documented in `docs/IMAGE-STORAGE-R2-INTEGRATION.md`
- [x] Admin.js response-shape mismatch fixed: `executeTransferWorkflow()` now reads the unwrapped `ApiService.post()` data object directly; dry-run guard checks `dryRunRes.dryRun` instead of the stripped `.success`/`.data` envelope; execute guard checks `execRes.status` against `['APPLIED','ALREADY_APPLIED']` for accurate failure reporting
- [x] Catalog database import executed: 15 OEMs, 88 categories, 169 products transferred into PostgreSQL via the Admin CMS in a single atomic transaction (1 ImportRun with APPLIED status)
- [x] Pre-handover readiness cleanup and verification: stripped leading carriage return and blank line from `public/sitemap.xml`; updated `scripts/prerender.js` with `.trim() + '\n'` to prevent leading whitespace in future builds; verified all 100 tests pass across all 8 backend test suites (including `productSeo.test.js` test 12); confirmed clean frontend production build (169 prerendered HTML product pages, 176 sitemap URLs); validated live dynamic backend `/sitemap.xml` and `/api/sitemap.xml` endpoints (HTTP 200, application/xml, 7 core pages, 169 visible product URLs, zero hash fragments, zero admin routes).
- [x] Client-Owned Resend Email Integration & Hardening: standardized primary sender on `RESEND_FROM_EMAIL` with legacy `ENQUIRY_FROM` fallback; eliminated silent fallback to `onboarding@resend.dev` in production; ensured missing credentials return explicit server-side configuration diagnostics without leaking secrets; corrected public Contact Us & Careers failure responses to accurately report automatic dispatch issues without falsely implying a customer confirmation email; guaranteed database pre-commit durability in PostgreSQL for all enquiries and career applications regardless of Resend API outcome; updated `backend/.env.example` with empty production placeholders; created dedicated unit test suite `backend/test/emailService.test.js` (13 tests) and expanded `backend/test/enquiries.test.js` (12 tests) verifying HTML escaping, error handling, and mock dispatch.
- [x] Database-Backed CMS Content (Finding H1 resolved): moved all non-catalog CMS marketing content (home hero/stats, about milestones, services pillars, contact office addresses, header, footer, partners, blogs, projects, gallery, testimonials, and SEO) from browser localStorage into PostgreSQL; added `SiteContent` model to Prisma schema with unique constraint on `pageKey`, foreign key audit link to `AdminUser`, and migration `20261105000000_add_site_content_model`; implemented public retrieval route `GET /api/content/:pageKey` and authenticated admin management routes (`GET /api/admin/content`, `GET /api/admin/content/:pageKey`, `PUT /api/admin/content/:pageKey`) with double-submit CSRF and admin session checks; integrated `ContentService.js` with in-memory cache, in-flight request deduplication, proactive startup preloading, and graceful offline fallback; added reactive event-driven DOM refreshes via `cms-data-updated`; implemented non-destructive legacy browser draft migration with status card and one-click sync button in Admin CMS; created dedicated backend test suite `backend/test/content.test.js` (11 tests); documented complete system in `docs/CMS-CONTENT-ARCHITECTURE.md`.
- [x] Phase 2.1 - Database-Backed CMS Hardening & Verification Findings Resolution: eliminated stale form hydration in `Admin.js` by awaiting `ContentService.loadAdminContent(pageKey)` upon tab switch and login; added optimistic concurrency control (`expectedUpdatedAt` / HTTP 409 Conflict with code `"CONCURRENT_MODIFICATION"`); resolved premature success toasts by awaiting `ContentService.saveData()` across all modal callbacks and card reorder/delete actions in all tabs (`home`, `services`, `projects`, `gallery`, `testimonials`, `contact`, `partners`, `blogs`, and `bindUniversalCardActions`), disabling buttons during saves, and keeping modal forms open with error messages on failure; preloaded all 12 CMS keys via `Promise.allSettled` in `src/main.js` and wired reactive view refresh on `cms-data-updated` ignoring active `/admin` sessions; implemented HTTP caching headers (`Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, ETag, HTTP 304 Not Modified) on public endpoints and `Cache-Control: no-store` on admin routes; added 60-second in-memory TTL with background revalidation; built draft inspection review modal with live DB customized badges, collision warnings, and draft preservation; expanded `backend/test/content.test.js` to 14 passing tests; verified full frontend build (169 prerendered products, 176 sitemap URLs).
- [x] Client Source-Code Handover Readiness: moved `prisma` to `dependencies` in `backend/package.json` and added `"migrate": "prisma migrate deploy"`; made prerender domain configurable via `VITE_SITE_ORIGIN` / `SITE_ORIGIN` with fallback to `https://iconelectromatic.com` in `scripts/prerender.js`; documented canonical origin variables in both `.env.example` files; cleaned up temporary diagnostic scripts; created comprehensive client external service setup guide in `docs/CLIENT-SERVICE-SETUP.md` covering PostgreSQL, Cloudflare R2, and Resend.
- [x] Enquiry Management Database Schema & Migration (Step 1): added `EnquiryRegion` (`INDIA`, `SINGAPORE`, `USA`), `EnquiryWorkflowStatus` (`NEW`, `ASSIGNED`, `IN_PROGRESS`, `QUOTED`, `CONTACTED`, `CLOSED`, `ARCHIVED`), and `CommunicationType` enums; added nullable `region`, `workflowStatus` (default `NEW`), and `assignedToId` to `Enquiry` model; created `EnquiryCommunication` model with `onDelete: Restrict`; added reverse relations to `AdminUser`; deployed migration `20261106000000_add_enquiry_workflow_and_communications` to isolated Docker test database (`127.0.0.1:5433` / `icon_electromatic_test`); confirmed historical enquiries maintain `region = null`.
- [x] Regional Sales Email Routing (Step 2): authoritative server-side regional destination mapping (`INDIA` -> `salesiepl@iconelectromatic.com`, `SINGAPORE` -> `IESing@iconelectromatic.com`, `USA` -> `salesiellc@iconelectromatic.com`) with fallback to `CONTACT_EMAIL`; client-injected recipient headers strictly rejected.
- [x] Contact Form Regional Office Selection (Step 3): public contact form dropdown for regional office selection; normalizes to uppercase enum; defaults cleanly to `null`; returns 400 Bad Request for invalid regions.
- [x] Customer Acknowledgement Emails (Step 4): durable pre-commit saving in PostgreSQL before email dispatch; internal sales notification dispatched first; branded customer acknowledgement sent only after internal sales dispatch succeeds; client-safe summary with `#IE-...` reference code; internal sales mailboxes never exposed; delivery failure recorded in `EnquiryCommunication.metadata` preserving `Enquiry.status = EMAILED` and HTTP 201; duplicate protection verifies history before sending.
- [x] Admin Dashboard Enquiry Management (Step 5): secure administrative management endpoints protected by `requireAdmin` (`GET /stats`, `GET /staff`, `GET /`, `GET /:id`, `PATCH /:id/status`, `PATCH /:id/assign`, `POST /:id/communications`); KPI summary cards and unreviewed enquiry notification badge in navigation; transactions for status and assignment updates with automatic `STATUS_CHANGE` audit records; automatic status advancement from `NEW` to `ASSIGNED`; deletion protection ensures records cannot be permanently destroyed.
- [x] Communication History & Dual CSV Export (Step 6): Enquiries Summary CSV (`GET /export`) and Communications Audit CSV (`GET /export-communications`, `GET /export?type=communications`) with UTF-8 BOM, RFC-4180 escaping, and formula-injection defense (`=+\-@\t\r` neutralized with `'`); decoupled internal sales email audit logging inside `try/catch` to isolate transient failures; optimistic concurrency control (`expectedUpdatedAt` / HTTP 409 `CONCURRENT_MODIFICATION`) with frontend chaining across dual status and assignee updates; route-level test suite for admin auth, role rejection, and CSRF token enforcement.
- [x] Final Technical Verification & Client Handover Runbook (Step 7): full backend test suite executed (173/173 tests passing, 0 failures, 0 skipped); frontend production build verified (169 product pages prerendered, 176 sitemap URLs generated); Prisma migration status verified up to date (5 migrations applied to Docker test database `127.0.0.1:5433`); comprehensive client handover runbook created in `docs/CLIENT-HANDOVER-GUIDE.md` covering service setup, database migration, first admin provisioning, reverse proxy configuration, enquiry management, and CSV downloads; `docs/CLIENT-SERVICE-SETUP.md` updated with regional sales mailboxes and Resend domain verification.
- [ ] Excel catalog reconciliation import (not performed)
- Prisma obtains the database URL from `DATABASE_URL`; confirm the actual target database and schema before any migration. Do not include credentials in documentation.
- A prior `npm audit` reported a high-severity `braces` advisory through nodemon/chokidar, with no compatible patched release available at that time; current status has not been rechecked.

## Decisions (confirmed by the owner)
| Date | Decision | Why |
|---|---|---|
| 2026-10 | Build the backend first, then SEO | SEO fields must exist in the data model from day one |
| 2026-10 | Whole project is built with Antigravity | Owner's workflow |
| 2026-10 | The CMS exposes all intended website content as editable | Owner's requirement |
| 2026-10 | Work one step at a time with detailed explanations | Owner is a beginner and wants senior-developer practices |
| 2026-10 | Automate via /new_feature, /finish_feature and GitHub Actions CI | Standardize branching, enforce safety rules, and ensure every PR builds clean |
| 2026-10 | Develop a separate Node.js + Express backend, use local PostgreSQL with Prisma, and use Cloudflare R2 for persistent image storage | Owner-selected architecture; Phase 1 is limited to the server foundation |

## Proposed, not yet confirmed
- Static site generation (Astro recommended) so every product is a real HTML page
- A managed headless CMS (for example Sanity) as the backend; Supabase with custom admin is the alternative
- A small serverless function for enquiries (validation, spam protection, regional email routing, saved copy)

## Known issues (as of 2026-10-29)
- Web addresses use clean HTML5 history routing with build-time static HTML prerendering (`dist/product/:id/index.html`) and backward-compatible redirects from legacy `/#/product/:id` URLs. Search engine indexing requires post-deployment verification in Google Search Console.
- Contact and careers forms now POST to real backend endpoints (`/api/enquiries/contact`, `/api/enquiries/careers`); email delivery requires `RESEND_API_KEY` and `CONTACT_EMAIL` to be configured in `backend/.env` — see `backend/.env.example` for setup steps
- Demo admin: password is pre-filled in the page (to be cleared in Stage 1 cleanup); non-catalog edits are now persisted directly in PostgreSQL via SiteContent; Employee Zone link is public, admin code ships in the production bundle
- Old fake product files (products.js, ProductDetail.js) are still in the repo
- "4,000+ products" and "24+ categories" placeholder claims removed from index.html (still present in Home.js, ContentService.js and Admin.js pending Stage 1 cleanup)
- Per-page titles, descriptions, canonical tags, sitemap, robots.txt and structured data implemented (Stage 7 completed)
- Large files: 65 MB presentation, hero videos, main JS bundle about 645 KB
- Repo is public and contains client files
- Two development-tool vulnerabilities (Vite, esbuild); affect the dev server only

## Open questions
1. Final product count: 169 in code, about 130 stated by the owner, 400+ claimed by the client
2. Who will operate and maintain the backend after handover?
3. Who edits and publishes at the client; is an approval step needed; do they add images and videos?
4. Confirm client creation of regional mailboxes: salesiepl@iconelectromatic.com (India), IESing@iconelectromatic.com (Singapore), and salesiellc@iconelectromatic.com (USA)
5. Has the budget been renegotiated?

## Environments (names only, no secrets)
- Production: not live yet
- Hosting: Vercel (to confirm)
- Domain: owned by the client (registrar access to confirm)

## How to resume work
1. Read AGENTS.md, then this file.
2. Pick the first unchecked item in the stage checklist.
3. Make a plan, wait for approval, work on a branch, update this file when done.
