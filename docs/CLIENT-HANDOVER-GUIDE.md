# Client Handover & Operations Guide

**Project:** ICON Electromatic B2B Catalog & CMS Website
**Date:** November 2026
**Audience:** Client Technical Team, System Administrators, and Sales Operations

---

## 1. Project Overview & Capabilities

This website is a production-ready, SEO-optimized B2B catalog platform built for **Icon Electromatic**, an authorized distributor of RF, microwave, and electronic components from OEM principals (including Rogers Corporation, Mini-Circuits, Qorvo, and others).

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

## 2. Architecture & Reverse Proxy Requirement

To deliver robust security, the frontend and backend are designed to run under a **single-origin reverse proxy**:

```
[ Client Browser / Administrator ]
               │
               ▼  HTTPS (TLS 1.3)
   https://iconelectromatic.com
               │
      ┌────────┴────────────────────────┐
      │  Reverse Proxy / CDN            │
      │  (e.g., Cloudflare / Vercel)    │
      └────────┬────────────────────────┘
               │
      ┌────────┴─────────────────────────────────┐
      │ Routes:                                  │
      │   /api/*          ──▶  Express API Server│
      │   /sitemap.xml    ──▶  Dynamic Sitemap   │
      │   /* (Static)     ──▶  Frontend Static   │
      └──────────────────────────────────────────┘
```

### Why Same-Origin `/api` Reverse Proxy is Required:
* **Session Cookie Hardening:** In production mode (`NODE_ENV=production`), admin authentication uses `__Host-` prefixed cookies (`__Host-admin_session` and `__Host-admin_csrf`). Browsers only store and transmit `__Host-` cookies when sent from the exact same origin over secure HTTPS with no domain attribute.
* **CORS Elimination:** Requests to `/api` are same-origin, eliminating complex cross-origin preflight requests.
* **Double-Submit CSRF Defense:** Modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) require both the secure CSRF cookie and an `X-CSRF-Token` header.

---

## 3. Required Environment Variables

All environment variables must be configured directly in your hosting platform dashboard. **Never commit `.env` files into Git.**

### Backend Environment Variables (`backend/.env`)

| Variable Name | Required | Example / Placeholder | Client Responsibility / Description |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production security (enforces `__Host-` cookies, strict CORS, and disables localhost). |
| `PORT` | **Yes** | `5000` | Port on which the Express server listens. |
| `FRONTEND_URL` | **Yes** | `https://iconelectromatic.com,https://www.iconelectromatic.com` | Comma-separated list of allowed frontend web origins. |
| `TRUST_PROXY` | **Yes** | `1` | Reverse proxy hops (set to `1` behind Cloudflare, Vercel, Railway, Render, or AWS ALB). |
| `SITE_ORIGIN` | **Yes** | `https://iconelectromatic.com` | Canonical public origin used for dynamic `/sitemap.xml` and prerender generation. |
| `DATABASE_URL` | **Yes** | `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public` | Connection URL for your production PostgreSQL 14+ database. Use `sslmode=require` for cloud databases. |
| `RESEND_API_KEY` | **Yes** | `re_123456789_abcdefghijklmnopqrstuv` | API key from your Resend account with "Sending access". |
| `RESEND_FROM_EMAIL` | **Yes** | `notifications@iconelectromatic.com` | Sender address on your verified domain in Resend. |
| `CONTACT_EMAIL` | **Yes** | `sales@iconelectromatic.com` | Primary fallback recipient inbox for enquiries and career applications. |
| `R2_ACCOUNT_ID` | **Yes** | `32-character hex account id` | Cloudflare R2 Account ID. |
| `R2_ACCESS_KEY_ID` | **Yes** | `32-character key` | S3 API Access Key ID generated in Cloudflare R2. |
| `R2_SECRET_ACCESS_KEY` | **Yes** | `64-character secret` | S3 API Secret Access Key generated in Cloudflare R2. |
| `R2_BUCKET_NAME` | **Yes** | `icon-electromatic-media` | Private bucket name in Cloudflare R2. |
| `R2_ENDPOINT` | **Yes** | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | S3 API endpoint URL for your Cloudflare R2 account. |
| `R2_PUBLIC_DOMAIN` | Optional | `https://media.iconelectromatic.com` | Optional public CDN custom domain connected to the R2 bucket. |

### Frontend Environment Variables (`.env`)

| Variable Name | Required | Example / Placeholder | Description |
|---|---|---|---|
| `VITE_API_URL` | Optional | `/api` | Base path for API requests. In same-origin reverse-proxy setups, leave as `/api` or empty. |
| `VITE_SITE_ORIGIN` | Optional | `https://iconelectromatic.com` | Canonical site origin for static prerendered HTML links and social sharing tags. |

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
   Add the DNS records generated by Resend to your domain registrar / DNS provider:
   * **SPF:** TXT record authorizing Resend servers.
   * **DKIM:** CNAME / TXT records for cryptographic email signing.
   * **DMARC:** TXT record for domain spoof protection.
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
4. **Secure Image Delivery:**
   The backend provides cached binary streaming via `GET /api/media/file/:id` with cross-origin headers (`CORP: cross-origin`), allowing product images to render without exposing bucket credentials.

---

## 7. Database Migration & Provisioning Runbook

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
*(This executes `prisma migrate deploy`, safely applying migrations up through `20261106000000_add_enquiry_workflow_and_communications` without resetting existing data.)*

### Step 3: Provision the First Administrator Account
Create your first active system administrator interactively:
```bash
cd backend
node scripts/provision-admin.js
```
* **Email:** Enter the administrator's corporate email.
* **Password:** Enter a secure password (minimum 14 characters, hidden input).
* **Confirm:** Re-enter the password.

The script hashes the password with cryptographic salt and creates an active administrator with role `ADMIN`.

### Step 4: Initial Catalog Transfer to PostgreSQL
1. Start the server and visit `/admin` in your browser.
2. Sign in with the newly provisioned administrator account.
3. Go to the **Catalog** tab.
4. A notice will indicate that PostgreSQL has 0 catalog records. Click **Execute Transfer to PostgreSQL**.
5. The system will perform an automatic pre-execution dry-run audit, then atomically populate all **15 OEM principals**, **88 product categories**, and **169 authentic products** into PostgreSQL.

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
* Launches the production Express server (`src/server.js`) on the configured `PORT`.

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
- [ ] `NODE_ENV=production` set in backend hosting dashboard.
- [ ] All automated tests pass (`node --test`).
- [ ] Frontend built and prerendered via `npm run build`.
- [ ] Manual browser check of `/admin` login, enquiry timeline, and CSV downloads completed.
