# Client Deployment Handover & Operations Guide

**Project:** ICON Electromatic B2B Catalog & CMS Website
**Date:** November 2026
**Audience:** Client Technical Team, System Administrators, and Sales Operations

The client owns and performs production deployment. This guide describes the
implemented application and the configuration the client must supply. Production
hosting, domains, credentials, and infrastructure have not been provisioned or
verified by the development team.

For transfer of repository ownership, collaborator access, branch rules, and CI
responsibilities, see the [GitHub Source Handover Guide](./GITHUB-SOURCE-HANDOVER-GUIDE.md).

---

## 1. Project Overview & Capabilities

The repository implements an SEO-oriented B2B catalog platform for **Icon
Electromatic**, an authorized distributor of RF, microwave, and electronic
components. Production hosting and deployment have not yet been provisioned or
verified; client configuration and launch checks remain outstanding.

### Key Systems Delivered:
1. **Public B2B Product Catalog:**
   * Clean HTML5 history routing (no hash fragments, e.g. `/product/:id`).
   * Build-time static prerendering of all 169 authentic products (`dist/product/:id/index.html`) with unique metadata, single `<h1>`, and rich Schema.org JSON-LD structured data for search engine crawlers.
   * Valid `sitemap.xml` (176 canonical URLs) and dynamic backend sitemap endpoint (`/sitemap.xml`).
2. **Database-Backed CMS Content:**
   * Non-catalog website marketing copy (homepage hero/stats, about us, services, office contacts, partners, testimonials, and blogs) stored securely in PostgreSQL with browser-draft preservation.
3. **Regional Enquiry & RFQ Management:**
   * Public contact form supporting regional routing (India HQ, Singapore, USA).
   * Durable pre-commit saving in PostgreSQL before email dispatch.
   * Internal sales notifications sent to authoritative regional inboxes.
   * Branded customer acknowledgement emails dispatched only after internal notification succeeds.
   * Enquiry reference numbering (e.g. `#IE-ABC12345`).
   * Suppression of customer acknowledgements on spam/honeypot or internal failures; zero leakage of internal sales addresses.
4. **Administrative Enquiry Operations Portal:**
   * Filtered enquiry listing by office, workflow status, search keyword, and assigned staff member.
   * Workflow lifecycle management: `NEW`, `ASSIGNED`, `IN_PROGRESS`, `QUOTED`, `CONTACTED`, `CLOSED`, `ARCHIVED`.
   * Real-time KPI summary counters and unreviewed enquiry notification badges.
   * Chronological audit timeline recording customer acknowledgements, internal notifications, status transitions, staff assignments, customer replies, phone logs, and staff notes.
   * Dual CSV reporting: Enquiries Summary CSV and Communications Audit CSV with built-in formula-injection protection and UTF-8 BOM.
   * Safe data model: permanent deletion is disabled; records are preserved for auditing.

---

## 2. Architecture & Hosting Requirements

Recommended topology: host the static frontend on a static-site platform such as
Vercel, host the Express API on a managed Node.js service, and use managed
PostgreSQL and Cloudflare R2. The client chooses providers and regions. Production
Docker infrastructure is not required.

```
[ Client Browser / Administrator ]
               │
               ▼  HTTPS (TLS 1.3)
   https://iconelectromatic.com
               │
      ┌────────┴────────────────────────┐
      │  Static host / CDN / proxy      │
      └────────┬────────────────────────┘
               │
      ┌────────┴─────────────────────────────────┐
      │ Routes:                                  │
      │   /api/*          ──▶  Express API Server│
      │   /sitemap.xml    ──▶  Backend sitemap  │
      │   /* (Static)     ──▶  Frontend Static   │
      └──────────────────────────────────────────┘
```

### Frontend hosting

- Build from the repository root with Node.js 22, `npm ci`, then `npm run build`.
- Publish the generated `dist/` directory. The build prerenders product pages and
  the Home, About, Products, Blogs, and Contact pages.
- Configure the host to serve existing files/directories before applying the SPA
  fallback to `/index.html`.
- Set `VITE_SITE_ORIGIN` to the client's final HTTPS canonical site origin at
  build time. For same-origin proxying, keep `VITE_API_BASE_URL` as `/api`.
  The optional runtime `window.__ICON_API_BASE__` override takes precedence.

### Backend hosting

- Deploy with the complete repository checkout/build context, including `shared/`;
  the backend is not a standalone package.
- Use Node.js 22 and install backend dependencies from `backend/` with `npm ci`.
- Configure backend variables through the hosting provider's secret/config store.
  Start from `backend/` with `npm start` (equivalent to `node src/server.js`).
- Let the platform provide `PORT` where applicable. Keep the service behind the
  frontend reverse proxy where supported.

### Why same-origin `/api` reverse proxy is required
* **Session Cookie Hardening:** In production mode (`NODE_ENV=production`), admin authentication uses `__Host-` prefixed cookies (`__Host-admin_session` and `__Host-admin_csrf`). Browsers only store and transmit `__Host-` cookies when sent from the exact same origin over secure HTTPS with no domain attribute.
* **CORS Elimination:** Requests to `/api` are same-origin, eliminating complex cross-origin preflight requests.
* **Double-Submit CSRF Defense:** Modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require both the secure CSRF cookie and an `X-CSRF-Token` header.

The current [vercel.json](../vercel.json) builds the static site, routes
`/sitemap.xml` to same-origin `/api/sitemap.xml`, and sends other unmatched paths
to `/index.html`. It does **not** contain a backend API origin or route `/api/*`
to a separately hosted service. Once the client chooses a backend provider, add
an explicit `/api/*` rewrite to that service and route the sitemap request to the
backend. Do not deploy the current configuration as though it already connects
the API. The backend origin is intentionally not invented here.

For self-managed hosting, an optional Nginx template is in
[Nginx template](./templates/nginx.conf.example), with
replacement and security notes in
[PRODUCTION-DEPLOYMENT-GUIDE.md](./PRODUCTION-DEPLOYMENT-GUIDE.md).

---

## 3. Required Environment Variables

All environment variables must be configured directly in your hosting platform dashboard. **Never commit `.env` files into Git.**

### Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Example / Placeholder | Client Responsibility / Description |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production security (enforces `__Host-` cookies, strict CORS, and disables localhost). |
| `PORT` | Hosting-dependent | Provider-assigned port (application default: `5000`) | Port on which the Express server listens. |
| `FRONTEND_URL` | **Yes** | `https://iconelectromatic.com,https://www.iconelectromatic.com` | Comma-separated list of allowed frontend web origins. |
| `TRUST_PROXY` | Hosting-dependent | Match the verified trusted proxy chain | Enables Express to resolve client IPs behind a proxy. Configure only when backend access is restricted to that proxy and it sanitizes or overwrites client-supplied forwarding headers. Never trust arbitrary forwarded headers or copy a generic hop count. |
| `SITE_ORIGIN` | **Yes** | `https://iconelectromatic.com` | Canonical public origin used for dynamic `/sitemap.xml` and prerender generation. |
| `DATABASE_URL` | **Yes** | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | Connection URL for your production PostgreSQL 14+ database. Use `sslmode=require` for cloud databases. |
| `RESEND_API_KEY` | Required for live email | Secret from provider | Resend sending API key; keep in the backend secret store. |
| `RESEND_FROM_EMAIL` | Required for live email | Sender on verified domain | Preferred sender setting. `ENQUIRY_FROM` is a legacy fallback only. |
| `CONTACT_EMAIL` | Required for live email | Client-approved fallback inbox | Receives general enquiries and career applications; regional enquiries use fixed server-side addresses. |
| `R2_ACCOUNT_ID` | Optional in app config | Cloudflare account identifier | The application uses the configured S3 endpoint and credentials directly. |
| `R2_ACCESS_KEY_ID` | Required for R2 | Secret from provider | Bucket-scoped R2 S3 API key ID. |
| `R2_SECRET_ACCESS_KEY` | Required for R2 | Secret from provider | Bucket-scoped R2 S3 API secret. |
| `R2_BUCKET_NAME` | Required for R2 | Client-selected bucket | Target bucket name. |
| `R2_ENDPOINT` | **Yes** | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | S3 API endpoint URL for your Cloudflare R2 account. |
| `R2_PUBLIC_DOMAIN` | Optional | Client-configured HTTPS domain | If set, media delivery redirects to this host, which must serve uploaded object keys. Otherwise the backend streams from the private bucket or uses a short-lived signed URL fallback. |

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are needed only for non-interactive first-admin
provisioning. `PRODUCTION_DATABASE_URL` is used only by the optional production
catalogue seeder. Supply these temporarily through a secret manager and remove
them after the operation.

### Frontend Environment Variables (`.env`)

| Variable Name | Required | Example / Placeholder | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Optional | `/api` | Build-time base path for API requests. A runtime `window.__ICON_API_BASE__` override takes precedence; otherwise, same-origin reverse-proxy setups use `/api`. |
| `VITE_SITE_ORIGIN` | Optional | `https://iconelectromatic.com` | Canonical site origin for static prerendered HTML links and social sharing tags. |

`SITE_ORIGIN` is the backend's canonical sitemap origin. The root
`.env.example` also lists it for build environments; use the client's canonical
HTTPS site origin when configuring the frontend build and backend service.

### Implementation status

**Implemented in the repository:** static product and core-page prerendering;
SPA fallback behavior; backend API and dynamic sitemap routes; Prisma migrations;
guarded read-only-by-default catalogue seeding; interactive and secret-store
admin provisioning; backend-mediated R2 upload and delivery; Resend-based email
dispatch with server-side regional routing.

**Client configuration and launch tasks:** choose frontend/backend/PostgreSQL
providers and regions; set production environment variables; configure same-origin
API and sitemap routing; apply migrations after target and backup verification;
provision the first administrator; select and authorize initial catalogue
population; configure R2, Resend, regional inboxes, DNS, and HTTPS; run the
verification checklist below.

**Future or unresolved items:** client-specific host/rewrite values cannot be
filled in before hosting is selected; R2 bulk migration and retired-object
cleanup are not implemented; `CmsDocument` remains pending a separate schema and
migration review. See [PROJECT-STATE.md](./PROJECT-STATE.md) and
[IMAGE-STORAGE-R2-INTEGRATION.md](./IMAGE-STORAGE-R2-INTEGRATION.md).

For the complete Prisma entity/field reference, see
[DATA-DICTIONARY.md](./DATA-DICTIONARY.md). For client-authorized backup,
restore, migration recovery, and incident procedures, see
[DISASTER-RECOVERY-RUNBOOK.md](./DISASTER-RECOVERY-RUNBOOK.md).

---

## 4. Regional Sales Mailboxes Setup

The backend features authoritative server-side regional enquiry routing. The client must ensure the following mailboxes or email aliases exist on your corporate mail server (`@iconelectromatic.com`):

1. **India HQ (Bengaluru):**
   * Expected address: `salesiepl@iconelectromatic.com`
   * Receives customer enquiries targeted to India HQ.
2. **Singapore Liaison Office:**
   * Expected address: `IESing@iconelectromatic.com`
   * Receives customer enquiries targeted to Singapore and Southeast Asia.
3. **USA Liaison Office:**
   * Expected address: `salesiellc@iconelectromatic.com`
   * Receives customer enquiries targeted to the Americas.
4. **General & Fallback Inbox (`CONTACT_EMAIL`):**
   * Configurable address (e.g. `sales@iconelectromatic.com` or `info@iconelectromatic.com`).
   * Receives enquiries where the customer selected no specific office, general RFQs, and career resume submissions.

> [!IMPORTANT]
> Verify that all three regional addresses are active and configured to receive inbound mail before pointing production traffic to the contact form.

---

## 5. Resend Email Delivery & Domain Verification

The website uses Resend for transactional customer notifications and internal sales routing:

1. **Sign Up & Add Domain:**
   Log in to [Resend](https://resend.com) and add your corporate domain: `iconelectromatic.com`.
2. **DNS Verification:**
   In your own Resend account, open the domain setup page and copy the exact DNS
   records and names it provides for the selected sending region. Add those
   records at the authoritative DNS provider. Do not assume a fixed number or
   type of records; requirements can vary. Coordinate SPF and DMARC with the
   client's existing mail administrator, and do not replace existing mail
   records blindly.
3. **Verification Check:**
   Confirm in Resend that the domain status is **Verified**. Emails sent from an unverified domain in production mode will be blocked.
4. **Sender Configuration:**
   Set `RESEND_FROM_EMAIL` to an address on your verified domain (e.g., `notifications@iconelectromatic.com`).

---

## 6. Cloudflare R2 Persistent Media Storage

Cloudflare R2 provides zero-egress S3-compatible storage for product images and CMS media:

1. **Bucket Creation:**
   Create a private bucket named `icon-electromatic-media` in the Cloudflare Dashboard under **R2**. Keep public access disabled by default.
2. **API Token Generation:**
   Under **Manage R2 API Tokens**, click **Create API Token** with **Object Read & Write** permissions scoped to your media bucket.
3. **Environment Setup:**
   Copy the Access Key ID, Secret Access Key, and S3 Endpoint into the backend environment variables.
4. **Implemented upload and delivery:**
   The Admin CMS sends uploads to authenticated backend
   `POST /api/media/upload`. The backend validates image bytes and size, writes
   the object to R2, then records the media asset in PostgreSQL. Public delivery
   uses `GET /api/media/file/:id`; by default the backend streams from the private
   bucket, with a signed-URL fallback. If `R2_PUBLIC_DOMAIN` is configured, the
   route redirects to that host instead. Browser-to-R2 uploads and bucket CORS
   are not part of this implemented upload flow.

---

## 7. Database Migration & Provisioning Runbook

The existing local Docker PostgreSQL container and database
`icon_electromatic_test` on port `5433` are for development/testing only. They
are not production infrastructure. The client should use a selected managed
PostgreSQL service unless its chosen hosting design has a documented reason to
self-host a database. No production Dockerfile or Compose stack is included.

When deploying to your production infrastructure, run the following steps in sequence:

### Step 1: Install Dependencies
```bash
# In repository root
npm ci

# In backend directory
cd backend
npm ci
```

### Step 2: Apply Database Migrations
Prisma migrations create all tables, enums, indexes, and relations automatically:
```bash
cd backend
npm run migrate
```
This runs Prisma `migrate deploy` from the backend package, applying pending
checked-in migrations without resetting the database. Confirm the provider's
PostgreSQL compatibility, backup/restore procedure, TLS settings, and the exact
target before running it. Do not run development-only migration-reset commands
against production.

### Step 3: Provision the First Administrator Account
Create your first active system administrator interactively:
```bash
cd backend
node scripts/provision-admin.js
```
* **Email:** Enter the administrator's corporate email.
* **Password:** Enter a secure password (minimum 14 characters, hidden input).
* **Confirm:** Re-enter the password.

The script hashes the password with a cryptographic salt and creates an active administrator with role `ADMIN`.

For deployment automation, provision with `--non-interactive` and pass `ADMIN_EMAIL` and `ADMIN_PASSWORD` through the platform's secret environment-variable store. Do not put the password in command-line arguments, logs, or shell history:
```bash
cd backend
node scripts/provision-admin.js --non-interactive
```
Non-interactive mode requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the
provider's secret store. Do not pass passwords as command-line arguments, print
them, or place them in shell history. Remove temporary provisioning secrets
after setup.

### Step 4: Initial Catalog Transfer to PostgreSQL
1. Start the server and visit `/admin` in your browser.
2. Sign in with the newly provisioned administrator account.
3. Go to the **Catalog** tab.
4. A notice will indicate that PostgreSQL has 0 catalog records. Click **Execute Transfer to PostgreSQL**.
5. The system will perform an automatic pre-execution dry-run audit, then atomically populate all **15 OEM principals**, **88 product categories**, and **169 authentic products** into PostgreSQL.

#### Optional production seed command

The Admin CMS transfer above is preferred. Use the dedicated production seed command only when the client explicitly chooses a baseline import and an authorized operator has confirmed the target. It does not delete or replace catalog records: it seeds only a clean, empty catalog, returns without changes for an already consistent baseline, and stops on partial, conflicting, or inconsistent data.

1. Arrange a verified database backup and obtain the production connection URL from the client's hosting provider. Provide it only as `PRODUCTION_DATABASE_URL` through a secure environment-variable or secret manager. The catalogue seeder requires `sslmode=verify-full`, which verifies both the TLS certificate chain and server hostname; it rejects `require` and `verify-ca`.
2. Run a read-only inspection first:
   ```bash
   cd backend
   npm run seed:production-catalog
   ```
3. If and only if the inspection confirms the intended production host and an empty catalog, run the apply command. Replace the placeholders using the exact host, port, and database name from the authorized connection URL:
   ```bash
   npm run seed:production-catalog -- --apply --confirm-production-seed="PRODUCTION_HOST:PRODUCTION_PORT/PRODUCTION_DATABASE"
   ```
4. Review the reported target and resulting status. Never use a test URL, paste credentials into the confirmation argument, or run the apply command without an approved backup and client authorization.

---

## 8. Build & Deployment Commands

### Frontend Build & Prerender
```bash
# In repository root
npm run build
```
* Builds the optimized Vite production bundle in `dist/`.
* Runs `scripts/prerender.js` to prerender all 169 product pages as static HTML at `dist/product/:id/index.html`.
* Generates `public/sitemap.xml` with 176 canonical URLs and `public/robots.txt`.

### Backend Server Start
```bash
cd backend
npm start
```
* Starts `src/server.js` using the provider-assigned `PORT`, or the application's
  default port when the provider does not set one.

### Backend Tests

From the repository root, set `TEST_DATABASE_URL` in the local PowerShell
session to the Docker test database `icon_electromatic_test` on port `5433`,
then run:

```powershell
npm test
```

The test runner rejects missing or non-local test database URLs, sets
`NODE_ENV=test`, and enables the suite's CI skips for tests that require live R2
or production-seeded catalog data. GitHub Actions uses its isolated
`icon_ci_test` database. The test suite includes database-backed tests and may
write test fixtures; do not point it at the native CMS database on port `5432`
or at any database containing data that must be preserved. The runner does not
apply migrations or reset databases.

### Content Security Policy

The Express backend serves API/media responses, not the frontend document, so
its disabled Helmet CSP does not protect the static website. Apply CSP at the
selected frontend host. That host is not selected yet, so enforcement remains
deferred.

The current page requires local scripts, inline styles used by generated
markup, Google Fonts (`fonts.googleapis.com` and `fonts.gstatic.com`), and
Font Awesome CSS/fonts from `cdnjs.cloudflare.com`. API requests use same-origin
`/api` by default but can use a configured API origin. CMS/product images and
media may use configured R2/CDN or approved external origins.

Candidate policy for **Report-Only review only**, not a ready-to-enforce header:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: blob: <approved-image-origins>; media-src 'self' blob: <approved-media-origins>; connect-src 'self' <configured-backend-origin>; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

Replace the placeholders only with client-approved origins. Review browser
violations on public pages and `/admin`, including API requests, R2 images/media,
fonts, and CMS behavior, before considering enforcement. Do not copy this draft
as an enforcing policy while its origins remain unresolved.

---

## 9. Administrator Guide: Enquiries & CSV Reports

Access the portal at `https://iconelectromatic.com/admin` (or `/admin` under your deployed domain).

### Navigation & Views
1. **Sidebar Badge:** Displays the real-time count of unreviewed (`NEW`) customer enquiries.
2. **KPI Summary Cards:** Click any KPI card (All, New, Assigned/Active, Quoted, Closed/Archived) to immediately filter the listing.
3. **Search & Filters:** Filter enquiries by target office (India HQ, Singapore, USA), workflow status, staff member, or customer search terms.

### Managing an Enquiry
Click **View Details** on any enquiry row to open the operational workspace:
1. **Customer & Enquiry Details:** View customer name, company, email, phone, target office, and full technical message.
2. **Workflow Status:** Advance the status across the business lifecycle:
   * `NEW` — Unreviewed submission.
   * `ASSIGNED` — Staff assigned; auto-advances when an assignee is selected.
   * `IN_PROGRESS` — Active review or RFQ calculation.
   * `QUOTED` — Formal quotation issued to customer.
   * `CONTACTED` — Customer contacted for clarifications.
   * `CLOSED` — Enquiry completed.
   * `ARCHIVED` — Inactive or soft-deleted record.
3. **Staff Assignment:** Assign the enquiry to any active staff member.
4. **Audit Timeline:** View the chronological record of:
   * Automated customer acknowledgement delivery (with delivery status and failure diagnostics).
   * Internal sales notification routing.
   * Status change audits (who changed it, old status, new status, timestamp).
   * Staff assignment logs (who assigned it, previous assignee, new assignee).
   * Manually recorded customer email replies, phone call notes, and internal team memos.
5. **Optimistic Concurrency Protection:** If two staff members edit the same enquiry simultaneously, the portal detects the collision (HTTP 409) and prompts to reload the latest data without overwriting edits.

---

## 10. Downloading & Opening CSV Reports

Two distinct CSV export reports are available in the **Enquiries** tab header for authorized administrators:

### 1. Export Enquiries CSV
* **How to access:** Click **Export Enquiries CSV** in the top-right toolbar.
* **Scope:** Exports all enquiries matching the currently applied filters (not just the current page).
* **Contents (15 columns):** Enquiry Reference Code, Submission Date (UTC), Customer Name, Company, Customer Email, Phone, Target Office, Enquiry Subject, Model/Band, Workflow Status, Assigned Staff, Dispatch Status, Total Communications Count, Latest Activity Date (UTC), and Customer Message.
* **Default Filename:** `icon-enquiries-YYYY-MM-DD.csv`.

### 2. Export Communications CSV
* **How to access:** Click **Export Communications CSV** in the toolbar.
* **Scope:** Full operational audit trail. Exports one row per communication event across all matching enquiries.
* **Contents (15 columns):** Enquiry Reference, Enquiry Date, Customer Name, Customer Email, Company, Target Office, Current Workflow Status, Communication ID, Event Date (UTC), Event Type (`EMAIL_OUTBOUND`, `CUSTOMER_REPLY`, `PHONE_LOG`, `INTERNAL_NOTE`, `STATUS_CHANGE`), Author/System, Subject/Action, Body/Notes, Delivery Status (`DELIVERED`, `FAILED`, `SKIPPED`), and Channel/Recipient.
* **Default Filename:** `icon-communications-YYYY-MM-DD.csv`.

### Opening CSV Files in Microsoft Excel
* **UTF-8 Compatibility:** Both CSV files include a UTF-8 Byte Order Mark (`\uFEFF`). When opened directly in Microsoft Excel (Windows or Mac), international company names, special characters, and formatting will render cleanly without requiring manual text-import wizard configuration.
* **Spreadsheet Security:** Both exports feature automatic formula-injection defense. Any cell beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is safely prefixed with a single quote (`'`), preventing malicious spreadsheet macros or calculation formulas from executing.

> [!NOTE]
> CSV exports are strictly protected by administrator authentication. Public website visitors cannot access or download enquiry data.

---

## 11. Pre-Launch Verification Checklist

Before directing public DNS traffic to the live production server:

- [ ] Production PostgreSQL 14+ database created and connection string tested.
- [ ] Database migrations applied cleanly via `npm run migrate`.
- [ ] First administrator provisioned via `node scripts/provision-admin.js`.
- [ ] Initial catalog imported via Admin CMS (15 OEMs, 88 categories, 169 products).
- [ ] Resend corporate domain `iconelectromatic.com` verified with SPF, DKIM, and DMARC DNS records.
- [ ] Three regional sales mailboxes (`salesiepl@...`, `IESing@...`, `salesiellc@...`) verified active on corporate email server.
- [ ] Cloudflare R2 bucket `icon-electromatic-media` created and API credentials configured.
- [ ] Reverse proxy configured to route `/api/*` and `/sitemap.xml` to the backend.
- [ ] Static host serves prerendered files before SPA fallback and has the final canonical site origin configured at build time.
- [ ] Backend runs on Node.js 22, has the full repository context (including `shared/`), and has its health check configured.
- [ ] API and sitemap rewrites point to the client-selected backend origin; `/api/*` does not fall through to the SPA HTML.
- [ ] `NODE_ENV=production` set in backend hosting dashboard.
- [ ] DNS points to the chosen frontend host, HTTPS is active, and all public pages and API paths use HTTPS.
- [ ] Backend access is restricted to the verified proxy; that proxy sanitizes or overwrites forwarded headers; `TRUST_PROXY` matches only that verified chain. If unverified, leave proxy trust disabled.
- [ ] Database backup and restore are confirmed before migrations or catalogue seeding.
- [ ] Client confirms whether to use the Admin CMS transfer or guarded baseline seed for initial catalogue population.
- [ ] All automated tests pass (`node --test`).
- [ ] Frontend built and prerendered via `npm run build`.
- [ ] Manual browser check of `/admin` login, enquiry timeline, and CSV downloads completed.
- [ ] Backup and restore process documented and restore tested in an isolated recovery database.
- [ ] Database model reference reviewed: [DATA-DICTIONARY.md](./DATA-DICTIONARY.md).
- [ ] Recovery and incident procedures reviewed: [DISASTER-RECOVERY-RUNBOOK.md](./DISASTER-RECOVERY-RUNBOOK.md).
