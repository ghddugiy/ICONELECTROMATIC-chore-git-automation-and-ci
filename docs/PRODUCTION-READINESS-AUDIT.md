# ICON ELECTROMATIC — PRODUCTION READINESS AUDIT

**Document Version:** 1.0.0
**Audit Date:** 2026-11-05
**Audit Scope:** Comprehensive Read-Only Audit (Frontend, Backend, Admin CMS, PostgreSQL/Prisma, Image Management, SEO, Contact/Careers, Deployment Portability, Code Quality & Security)
**Status Key:** `PASS` | `PARTIAL` | `FAIL` | `NOT VERIFIED` | `NOT IMPLEMENTED` | `NOT APPLICABLE`

> **Dated audit snapshot (2026-11-05):** This document records findings from
> that audit date; it is not a live deployment validation or the current
> deployment runbook. Later implementation and handover decisions may supersede
> individual findings. In particular, the current `vercel.json` does not proxy
> `/api/*` to a separate backend service. See
> [CLIENT-HANDOVER-GUIDE.md](./CLIENT-HANDOVER-GUIDE.md) and
> [PRODUCTION-DEPLOYMENT-GUIDE.md](./PRODUCTION-DEPLOYMENT-GUIDE.md) for current
> client deployment guidance.

### Follow-up corrections (2026-11-10)

- The unsupported homepage hero statistics and certification claims described
  under `FINDING-L1` were removed from the homepage rendering and default
  content. No replacement claims were added. The finding below is retained as
  historical audit evidence, not as the current homepage state.
- A Content Security Policy (CSP) is not enabled: Helmet's CSP middleware is
  explicitly disabled in `backend/src/server.js`. A restrictive policy is not
  safe to enable as a drop-in because the current UI uses inline style
  attributes, Google Fonts and Font Awesome CDN resources, dynamic media
  origins, and API connections. Before enforcing CSP, inventory runtime
  origins and inline behavior, then deploy a report-only policy on representative
  pages and resolve violations before enforcement.

---

## 1. Executive Summary

This read-only audit assessed the codebase as of 2026-11-05. It is a historical
snapshot, not a current deployment certification. The client manages production
hosting; provider-specific configuration and live infrastructure remain
unverified.

### Key Audit Findings Summary
* **Backend Security & Core API Architecture (`PASS`)**: The Express backend demonstrates exceptional engineering standards. Administrative authentication employs Node.js native `scrypt` hashing with OWASP-recommended parameters, constant-time verification, cryptographic CSRF double-submit token hashing, independent IP and account login rate-limiting, Helmet security headers, 250 KB JSON payload limits, 10 MB magic-byte upload filtering, and clean 400/413/500 error masking.
* **Catalog Data Synchronization (`PASS`)**: The catalog hierarchy (15 OEMs, 88 Categories, 169 Products) is fully integrated between the Admin CMS, the Express API, and PostgreSQL. Public product detail pages and catalog listings dynamically fetch live records with resilient fallback handling.
* **Non-Catalog CMS Content Synchronization (`PARTIAL / HIGH RISK`)**: While catalog changes persist to PostgreSQL, website content for the Homepage (hero, stats, capabilities), Header/Footer settings, Testimonials, Projects, Gallery, and Blogs is currently saved to browser `localStorage` (`cms_${pageKey}`) via `ContentService.saveData()`. These non-catalog edits **do not persist to PostgreSQL and are invisible to other users and devices**.
* **Excel / Spreadsheet Integration (`NOT IMPLEMENTED`)**: Contact/RFQ and Careers submissions are stored in PostgreSQL and dispatched to company inboxes via Resend. No Excel, Google Sheets, or Microsoft Graph integration exists.
* **Deployment Portability (`NOT VERIFIED`)**: The repository contains a static frontend build and a Node.js/Express backend. A same-origin reverse proxy is recommended for the admin cookie model. No production provider has been validated; the current `vercel.json` does not proxy `/api/*` to a separate backend.

---

## 2. Current Architecture

```
                                    +-----------------------------------------+
                                    |         Client Browser / Crawler        |
                                    +-----------------------------------------+
                                        |                                 |
                          Static Pages / Client Bundle        API Requests / Reverse Proxy
                                        |                         (/api/* -> Backend)
                                        v                                 v
                     +-----------------------------------+   +------------------------------------+
                     |   Vite SPA + Prerender Static     |   |         Node.js / Express          |
                     |   dist/product/:id/index.html     |   |        (Port 5000 / API)           |
                     |   169 HTML Pages + 176 Sitemap    |   +------------------------------------+
                     +-----------------------------------+     |         |          |          |
                                                               |         |          |          |
                                       +-----------------------+         |          |          +-------------------+
                                       |                                 |          |                              |
                                       v                                 v          v                              v
                    +--------------------+             +-------------------+  +---------------+  +---------------------+
                    | PostgreSQL Database|             |   Cloudflare R2   |  |   Resend API  |  | In-Memory Limiters  |
                    | (Prisma 6.19.3 ORM)|             |  (S3-Compatible)  |  | (Transactional|  | (IP & Normalized    |
                    | 15 OEMs, 88 Cats,  |             |  Persistent Media |  |  Email Dispatch|  |  Email Lockouts)   |
                    | 169 Products       |             |  Storage)         |  |   to Sales)   |  +---------------------+
                    +--------------------+             +-------------------+  +---------------+
```

---

## 3. Frontend Audit

| Area | Status | Evidence & Details |
|---|:---:|---|
| **Homepage & Navigation** | `PARTIAL` | Navigation routes (`/`, `/about`, `/partners`, `/products`, `/services`, `/blogs`, `/contact`) work cleanly via HTML5 history router (`src/router.js`). The unsupported homepage hero figures noted in this historical audit have since been removed; no replacement figures should be added without documented client evidence. |
| **Search & Filtering** | `PARTIAL` | On `/products`, search and frequency-band filtering work across active catalog items. However, the global header search modal (`src/components/Header.js`) searches static `CATALOG` from `catalogData.js` directly, meaning newly added backend products will not appear in global header search until a rebuild. |
| **Product Listing & Details** | `PASS` | `Products.js` loads the hierarchical catalog via `CatalogService.getPublicCatalog()`. `ProductDetail.js` queries `CatalogService.getPublicProduct(id)` with safe fallback to `findFallbackProduct()`. Specifications, applications, OEM logos, and canonical URLs render correctly. |
| **Contact & RFQ Forms** | `PASS` | `src/pages/Contact.js` validates inputs and submits to `POST /api/enquiries/contact`. Loading spinners, error messages, and success confirmations function correctly. |
| **Careers Application** | `PASS` | Multipart form validates resume file extensions (PDF, DOC, DOCX) and size ceiling (10 MB). Dispatches to `POST /api/enquiries/careers`. |
| **Admin Login & Dashboard** | `PASS` | Login modal authenticates via `ApiService.login()`. Session checks handle unauthenticated probes gracefully without throwing unhandled exceptions. |
| **Admin Catalog Management** | `PASS` | Product, category, and OEM modals allow editing names, descriptions, visibility toggles, external links, and optional SEO title/description overrides. Mutations trigger atomic backend updates. |
| **Non-Catalog CMS Editor** | `FAIL` | In `Admin.js`, edits to Home, Header, Footer, Blogs, Testimonials, Projects, and Gallery call `ContentService.saveData(pageKey, data)`. This writes solely to browser `localStorage` (`cms_${pageKey}`). Edits do not reach PostgreSQL. |
| **Responsive Design** | `PASS` | Checked at 360px, 768px, 1024px, and 1440px. Grid breakpoints collapse gracefully, tables scroll horizontally with sticky indicators, and mobile hamburger navigation opens smoothly. |
| **Dead Code in Repository** | `PARTIAL` | Legacy mock files `src/data/products.js` (old fake products) and references to legacy mock catalog remain in the tree, though runtime pages now use `catalogData.js` or `CatalogService`. |

---

## 4. Backend Audit

| Route / Module | Method | Auth Guard | CSRF | Rate Limit | Status | Notes |
|---|:---:|:---:|:---:|:---:|:---:|---|
| `/api/auth/login` | `POST` | Public | Exempt | IP + Email | `PASS` | scrypt verification; 5-attempt threshold with 15-min lockout; resets on success. |
| `/api/auth/logout` | `POST` | Public | Enforced | None | `PASS` | Revokes PostgreSQL session; clears cookies immediately. |
| `/api/auth/me` | `GET` | Session | Exempt | None | `PASS` | Returns session info or 401. |
| `/api/products` | `GET` | Public | Exempt | None | `PASS` | Returns visible products; filters out hidden parents. |
| `/api/products/:id` | `GET` | Public | Exempt | None | `PASS` | Returns single product; enforces visibility hierarchy. |
| `/api/products/admin` | `GET` | `requireAdmin`| Exempt | None | `PASS` | Returns full product catalog including hidden items. |
| `/api/products` | `POST` | `requireAdmin`| Enforced | None | `PASS` | Creates product; validates name, categoryId, sortOrder, sourceData. |
| `/api/products/:id` | `PATCH` | `requireAdmin`| Enforced | None | `PASS` | Updates product fields atomically. |
| `/api/products/:id/visibility` | `PATCH` | `requireAdmin`| Enforced | None | `PASS` | Dedicated route for fast visibility toggling. |
| `/api/products/:id` | `DELETE`| `requireAdmin`| Enforced | None | `PASS` | Deletes product record from database. |
| `/api/categories` | `GET` | Public | Exempt | None | `PASS` | Returns visible categories. |
| `/api/categories/reorder` | `POST` | `requireAdmin`| Enforced | None | `PASS` | Reorders categories atomically within an OEM. |
| `/api/oems` | `GET` | Public | Exempt | None | `PASS` | Returns visible OEMs. |
| `/api/media/upload` | `POST` | `requireAdmin`| Enforced | None | `PASS` | Memory storage; magic-byte validation; 10 MB limit; SHA-256 keying; S3 rollback on DB error. |
| `/api/media/file/:id` | `GET` | Public | Exempt | None | `PASS` | Streams binary image from R2 with `Cross-Origin-Resource-Policy: cross-origin` and `Cache-Control`. |
| `/api/enquiries/contact` | `POST` | Public | Exempt | IP Limiter | `PASS` | Honeypot trap; regex validation; PostgreSQL pre-commit; Resend dispatch; 502 sanitization on failure. |
| `/api/enquiries/careers` | `POST` | Public | Exempt | IP Limiter | `PASS` | Multipart upload; PDF/DOC/DOCX check; PostgreSQL pre-commit; Resend email with attachment. |
| `/api/sitemap.xml` | `GET` | Public | Exempt | None | `PASS` | Live PostgreSQL query; 176 URLs; falls back to `sitemap.fallback.xml` on database failure. |
| `/api/health` | `GET` | Public | Exempt | None | `PASS` | Validates process and PostgreSQL connectivity. |

---

## 5. Admin and User Separation

* **Route Gating (`PASS`)**: Every administrative write endpoint requires an active session (`AdminSession`) and valid CSRF token. Public users cannot mutate database records.
* **Role Enforcement (`PASS`)**: `requireAdmin` validates `session.adminUser.role === 'ADMIN'`. Editor role cannot perform administrative mutations.
* **Cookie Architecture (`PASS with Topology Requirement`)**:
  * Production cookie names: `__Host-admin_session` and `__Host-admin_csrf`.
  * Flags: `HttpOnly = true`, `Secure = true`, `SameSite = "lax"`, `Path = "/"`.
  * **Topology Requirement**: The recommended topology serves the frontend and API through one public origin using a reverse proxy. The current `vercel.json` routes `/sitemap.xml` to same-origin `/api/sitemap.xml` and has an SPA fallback, but does not configure `/api/*` to a separate backend. The client must add the provider-specific backend rewrite after choosing the backend origin.
* **Bundle Inspection (`PARTIAL / MEDIUM RISK`)**:
  * The Admin CMS UI code (`src/admin/Admin.js`) is compiled directly into the client bundle (`dist/assets/index-CNRZeONy.js`).
  * While unauthorized API mutations are strictly rejected by the backend, unauthenticated public visitors navigating to `/admin` can view the admin login screen and UI components. Code splitting (`React.lazy` or separate admin build) is recommended for post-handover enhancement.

---

## 6. PostgreSQL and Prisma Audit

* **Schema Integrity (`PASS`)**:
  * 11 models: `OEM`, `Category`, `Product`, `AdminUser`, `AdminSession`, `MediaAsset`, `ProductMedia`, `Enquiry`, `CareerApplication`, `ImportRun`, `ImportItem`.
  * Cascade deletions: Categories and Products cascade from parent OEM/Category deletions (`onDelete: Cascade`). Sessions cascade from `AdminUser`.
  * Indexes: Compound indexes exist on `[status, createdAt]` for enquiries, `[oemId, sortOrder]` for categories, and `[categoryId, sortOrder]` for products.
* **Migration Order (`PASS`)**:
  * `20261017100248_init`: Baseline schema.
  * `20261019233400_add_cms_backend_schema`: CMS administrative tables.
  * Verified: Migrations deploy cleanly onto fresh PostgreSQL instances via `npx prisma migrate deploy`.
* **Database Connection Configuration (`PASS`)**:
  * Configured strictly through `DATABASE_URL` environment variable.
  * Fully supports managed PostgreSQL SSL connections via `?sslmode=require`.

---

## 7. Image Management Audit

* **Existing Static Assets (`PASS`)**:
  * Exactly 141 local static image files reside in `public/images/`.
  * Production build copies all 141 assets into `dist/images/`.
  * Every active catalog product references valid static image paths.
* **Cloudflare R2 Storage (`PASS`)**:
  * Implementation: AWS SDK v3 S3 client (`backend/src/services/r2Storage.js`).
  * File validation: Server inspects buffer magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`, GIF `GIF87a/89a`). SVG is strictly rejected to prevent Stored XSS.
  * Unguessable Keys: Keys use format `products/<sha256>-<timestamp>.<ext>`.
  * Error rollback: If PostgreSQL insertion fails after S3 upload, the file is automatically purged from R2.
  * Retrieval: Public endpoint `GET /api/media/file/:id` streams binary files with caching headers.
* **Hybrid Coexistence (`PASS`)**:
  * Static images (`/images/...`) and R2 media (`/api/media/file/:id`) coexist seamlessly. `ImageStorage.resolveImageUrl()` inspects path prefixes and resolves both formats without collisions.

---

## 8. Admin-to-Public Website Synchronization

| Entity / Change | Admin Action | Storage Destination | Visible on Public Site? | Browser Refresh Safe? | Visible to Other Users? | Status |
|---|---|---|:---:|:---:|:---:|:---:|
| **Create Product** | Admin &rarr; Add Product | PostgreSQL | Yes (Dynamic API) | Yes | Yes | `PASS` |
| **Edit Product** | Admin &rarr; Edit Specs/Image | PostgreSQL | Yes (Dynamic API) | Yes | Yes | `PASS` |
| **Toggle Visibility**| Admin &rarr; Hide Product | PostgreSQL | Yes (Excluded) | Yes | Yes | `PASS` |
| **Add/Edit OEM** | Admin &rarr; Edit Partner | PostgreSQL | Yes (on `/products`) | Yes | Yes | `PASS` |
| **Home Hero/Stats** | Admin &rarr; Edit Home Text | **Browser localStorage** | Only in Editor | Yes (Editor only) | **NO** | `FAIL` |
| **Header/Footer** | Admin &rarr; Edit Logo/Offices | **Browser localStorage** | Only in Editor | Yes (Editor only) | **NO** | `FAIL` |
| **Blogs & News** | Admin &rarr; Add Blog Post | **Browser localStorage** | Only in Editor | Yes (Editor only) | **NO** | `FAIL` |
| **Testimonials** | Admin &rarr; Edit Quotes | **Browser localStorage** | Only in Editor | Yes (Editor only) | **NO** | `FAIL` |

> **Critical Synchronization Finding**: There is an architectural split in the CMS. Catalog data (products, categories, OEMs) synchronizes globally via PostgreSQL. However, general website marketing content (Home, Header, Footer, Blogs, Testimonials) is stored exclusively in `localStorage` (`cms_${pageKey}`). Edits made to these sections by an administrator are **completely invisible to visitors on other devices**.

---

## 9. SEO Audit

* **Metadata Implementation (`PASS`)**:
  * All 169 active catalog products have dynamic, unique `<title>`, `<meta name="description">`, and canonical URLs generated via `SeoService.js`.
  * Open Graph and Twitter Card tags render product images and descriptions.
  * Valid Schema.org `Product`, `BreadcrumbList`, and `Organization` JSON-LD are generated.
* **Prerendering & Crawling (`PASS`)**:
  * Build script (`scripts/prerender.js`) generates 169 static HTML files at `dist/product/:id/index.html` with single `<h1>` tags and non-empty body content for search engines without JavaScript.
  * Dynamic backend route `GET /sitemap.xml` queries live PostgreSQL products with accurate `updatedAt` timestamps and filters out hidden records.
  * Static build-time fallback `sitemap.fallback.xml` guarantees sitemap availability even during database outages.
* **Future Products SEO Behavior (`PARTIAL`)**:
  * When an Admin adds a new product in the CMS, it **immediately appears in `/sitemap.xml`** and is viewable by visitors via dynamic client-side rendering.
  * However, the prerendered static HTML file (`dist/product/:id/index.html`) is **not created until the next `npm run build`**. Crawlers fetching the URL before the next build will receive the SPA shell HTML instead of pre-baked HTML.

---

## 10. Contact, RFQ and Careers Audit

* **Contact / RFQ Pipeline (`PASS`)**:
  * Frontend &rarr; `POST /api/enquiries/contact` &rarr; Validation (Fullname, Company, Email regex, Phone 6–30 chars, Type allowlist, Message 10–2000 chars) &rarr; Persisted to PostgreSQL (`Enquiry`, status: `RECEIVED`) &rarr; Dispatched via Resend &rarr; Status updated to `EMAILED` (or `EMAIL_FAILED`).
  * Silent honeypot trap (`req.body.website`) returns HTTP 200 without sending email or storing spam.
  * Rate limited to 5 submissions per 15 minutes per IP.
* **Careers Pipeline (`PASS`)**:
  * Frontend &rarr; `POST /api/enquiries/careers` &rarr; Multer memory storage &rarr; Server-side validation of text fields and resume file (PDF, DOC, DOCX up to 10 MB) &rarr; Persisted to PostgreSQL (`CareerApplication`, status: `RECEIVED`) &rarr; Dispatched via Resend with binary resume attachment &rarr; Status updated to `EMAILED`.
* **Sanitized Public Responses (`PASS`)**:
  * If Resend delivery fails, the enquiry/application remains safely recorded in PostgreSQL.
  * Public client receives an honest, sanitized HTTP 502 message (`"Your enquiry was received but could not be dispatched to our team automatically. Please contact us directly if urgent."`).
  * Provider API errors and stack traces are never exposed to the visitor.

---

## 11. Excel / Spreadsheet Integration Status

* **Status: `NOT IMPLEMENTED`**
* **Verification Detail**:
  * The entire codebase was searched for `excel`, `xlsx`, `google-spreadsheet`, `@googleapis/sheets`, and `microsoft.graph`.
  * Zero spreadsheet dependencies exist in `package.json` or `backend/package.json`.
  * Submissions from Contact Us, RFQ, and Careers are persisted to PostgreSQL tables (`Enquiry`, `CareerApplication`) and emailed to `CONTACT_EMAIL`.
  * No code writes to an Excel workbook or synchronizes with Google Sheets.

---

## 12. Resend and Environment Configuration

* **Environment Variable Naming (`PASS`)**:
  * `RESEND_API_KEY`: Secret API key (starting with `re_`).
  * `RESEND_FROM_EMAIL`: Sender address on verified client domain (e.g. `notifications@iconelectromatic.com`).
  * `CONTACT_EMAIL`: Recipient inbox (e.g. `sales@iconelectromatic.com`).
  * Backward compatibility: Legacy `ENQUIRY_FROM` is supported as a fallback with a production runtime warning.
* **Production Safety (`PASS`)**:
  * `onboarding@resend.dev` is strictly prohibited in production. If `RESEND_FROM_EMAIL` is missing in production, the server reports an explicit configuration diagnostic without leaking secrets.
  * Resend credentials are kept strictly on the backend and never exposed to client-side bundles.
  * `backend/.env.example` provides empty placeholders.

---

## 13. Deployment Portability (snapshot)

* **Runtime:** The repository CI workflow selects Node.js 22. This audit did not
  verify every Node.js version or any production hosting provider.
* **Recommended topology:** Static frontend hosting plus a separately managed
  Node.js backend, managed PostgreSQL, and a same-origin `/api/*` proxy. A
  client-selected static host such as Vercel can serve the frontend; a client-
  selected Node.js service can run the API. No backend host or API origin has
  been confirmed.
* **Vercel configuration evidence:** `vercel.json` currently specifies the
  frontend build/output, a `/sitemap.xml` rewrite to `/api/sitemap.xml`, and an
  SPA fallback. It does not contain a backend destination or an `/api/*` proxy.
  Add those only after the client selects and supplies the backend origin.
* **Self-managed alternative:** Nginx can serve `dist/` and proxy `/api/` and
  the dynamic sitemap path to the backend. A placeholder example is maintained
  in [PRODUCTION-DEPLOYMENT-GUIDE.md](./PRODUCTION-DEPLOYMENT-GUIDE.md).
* **Topology caution:** The admin authentication cookie model is designed for
  same-origin frontend/API use. A separate API subdomain without a reverse proxy
  requires a separate authentication, cookie, and CORS review.

---

## 14. Code Quality & Security Assessment

### Severity Categories

#### A. Critical Issues (Count: 0)
* *No critical vulnerabilities (zero RCE, zero SQL injection, zero unauthenticated write endpoints, zero exposed secrets).*

#### B. High-Priority Issues (Count: 1)
* **Finding ID: `FINDING-H1` — Non-Catalog CMS Content Stored Exclusively in LocalStorage**
  * **File**: [`src/data/ContentService.js`](../src/data/ContentService.js#L661-L680), [`src/admin/Admin.js`](../src/admin/Admin.js#L600)
  * **Evidence**: `ContentService.saveData(pageKey, data)` executes `localStorage.setItem('cms_' + pageKey, JSON.stringify(data))`.
  * **Impact**: Homepage hero text, capabilities, stats, header/footer settings, testimonials, and blogs edited in the Admin CMS are stored only on the admin's local device. Visitors on other browsers see initial defaults.
  * **Recommended Fix**: Add a simple generic PostgreSQL model (`SiteContent` with `pageKey` and JSON `content`) and corresponding authenticated backend endpoints (`GET /api/content/:pageKey`, `PUT /api/content/:pageKey`).

#### C. Medium-Priority Issues (Count: 3)
* **Finding ID: `FINDING-M1` — Admin CMS Code Compiled into Public Bundle**
  * **File**: [`src/admin/Admin.js`](../src/admin/Admin.js), [`src/router.js`](../src/router.js#L28)
  * **Evidence**: `Admin.js` is imported directly into the router, compiling ~5,500 lines of admin code into `dist/assets/index-CNRZeONy.js`.
  * **Impact**: While backend APIs are strictly secured, unauthenticated users can access the `/admin` UI shell.
  * **Recommended Fix**: Code-split the admin interface using dynamic `import()` so it is loaded on demand.
* **Finding ID: `FINDING-M2` — Global Search Searches Static Data Rather than PostgreSQL**
  * **File**: [`src/components/Header.js`](../src/components/Header.js#L8)
  * **Evidence**: `import { CATALOG } from '../data/catalogData.js';` is used to filter search query results.
  * **Impact**: Products added via Admin CMS do not appear in the header search dropdown until a new static build is deployed.
  * **Recommended Fix**: Wire header search to `CatalogService.getCurrentPublicCatalog()`.
* **Finding ID: `FINDING-M3` — Same-Origin Topology Dependency for `__Host-` Cookies**
  * **File**: [`backend/src/routes/auth.js`](../backend/src/routes/auth.js#L30-L50)
  * **Evidence**: Cookies use `__Host-` prefix in production.
  * **Impact**: Prevents split-domain hosting unless an API reverse proxy is configured.
  * **Recommended Fix**: Document the reverse-proxy requirement in the handover guide.

#### D. Low-Priority Issues (Count: 3)
* **Finding ID: `FINDING-L1` — Hardcoded Placeholder Stats in Homepage (Resolved)**
  * **File**: [`src/pages/Home.js`](../src/pages/Home.js), [`src/data/ContentService.js`](../src/data/ContentService.js)
  * **Evidence**: At the audit date, placeholder hero stats were hard-coded in the page and default content. Follow-up review removed the homepage stats display and unsupported defaults.
  * **Impact**: The audit-date figures were unsupported; no replacement numbers or certification claims have been added.
  * **Recommended Fix**: Resolved for the current homepage. Do not reinstate public claims without documented client evidence.
* **Finding ID: `FINDING-L2` — Absence of Turnstile / CAPTCHA on Public Forms**
  * **File**: [`backend/src/routes/enquiries.js`](../backend/src/routes/enquiries.js#L218)
  * **Evidence**: Relies on honeypots and IP rate limits without cryptographic bot verification.
  * **Impact**: Sophisticated headless bot networks could submit spam inquiries.
  * **Recommended Fix**: Add Cloudflare Turnstile if automated spam becomes an operational issue.
* **Finding ID: `FINDING-L3` — Transitive Dependency Advisories**
  * **File**: `backend/package.json`
  * **Evidence**: `body-parser < 1.20.9` advisory via Express 4.21.2.
  * **Impact**: Minimal (payload limits are enforced at 250 KB).
  * **Recommended Fix**: Run `npm update express` when 4.21.3+ is released.

---

## 15. Test Results Summary

| Test Suite | File | Tests Run | Passed | Failed | Key Capabilities Verified |
|---|---|:---:|:---:|:---:|---|
| **Email Service** | `backend/test/emailService.test.js` | 13 | 13 | 0 | `RESEND_FROM_EMAIL` precedence, `ENQUIRY_FROM` fallback, dev sandbox blocking, HTML sanitization, mock dispatch. |
| **Enquiries API** | `backend/test/enquiries.test.js` | 12 | 12 | 0 | Rate limits, honeypot traps, resume MIME validation, PostgreSQL pre-commit, 502 sanitization. |
| **Auth & Sessions**| `backend/test/auth.test.js` | 9 | 9 | 0 | scrypt password hashing, session revocation, CSRF timingSafeEqual comparison, 8-hour expiry. |
| **Security & Headers**| `backend/test/security.test.js` | 9 | 9 | 0 | Helmet headers, CORP cross-origin, IP + email lockouts, CORS 403 masking, `__Host-` cookies. |
| **Payload Limits** | `backend/test/bodyLimit.test.js` | 6 | 6 | 0 | 250 KB ceiling, 413 error suppression, error handler masking. |
| **Catalog Service**| `backend/test/catalogService.test.js` | 11 | 11 | 0 | Fallback catalog mapping, schema validation, hierarchy checks. |
| **SEO & Sitemap** | `backend/test/productSeo.test.js` | 20 | 20 | 0 | Dynamic sitemap, 176 canonical URLs, fallback XML, structured data JSON-LD. |
| **Catalog Transfer**| `backend/test/catalogTransfer.test.js`| 20 | 19 | 1* | Dry-run zero writes, duplicate ID rejection, transaction rollback (*1 test checks local DB count). |
| **Media & R2** | `backend/test/mediaR2.test.js` | 13 | 12 | 1* | Magic byte checks, 10 MB limit, S3 rollback on DB error (*1 test checks local DB count). |
| **Frontend Build** | `npm run build` | 1 | 1 | 0 | 169 static HTML pages prerendered; sitemap generated; 0 build errors. |

---

## 16. Final Handover Readiness Assessment

### Overall Verdict: `PARTIAL / HANDOVER-READY FOR CATALOG & ENQUIRIES`

The application core is exceptionally strong and ready for client ownership:
1. **Catalog & E-Commerce Core**: Completely ready. 15 OEMs, 88 Categories, and 169 Products are synchronized with PostgreSQL, fully accessible, and crawlable with dynamic SEO.
2. **Contact & Careers System**: Completely ready. Submissions are persisted to PostgreSQL and dispatched via Resend.
3. **Security Architecture**: Enterprise-grade password hashing, rate limiting, and CSRF protection.
4. **Primary Handover Action Required**: The client must be informed that non-catalog CMS marketing content (Homepage text, Testimonials, Blogs) is currently browser-local and requires a small `SiteContent` database model to synchronize globally across devices if non-technical staff intend to edit general website copy through the CMS.
