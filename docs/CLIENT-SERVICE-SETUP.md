# External Service Setup Guide

This document explains how to create and configure the three external cloud services required to operate the Icon Electromatic website:

1. **PostgreSQL Database** (Product catalog, customer enquiries, CMS content)
2. **Cloudflare R2 Storage** (Persistent image and media storage)
3. **Resend Email Service** (Contact enquiries and career application notifications)

This is a service setup guide, not the end-to-end deployment runbook. Once you
have created the services, place credentials in the client-controlled secret
store and grant access only to an authorized deployment operator. Do not send
secrets in email or commit them to the repository.

---

## 1. PostgreSQL Database Setup

The website uses PostgreSQL to store catalog data, enquiries, and CMS content.

### Step-by-Step Instructions:

1. **Provision a PostgreSQL Database:**
   * Create a PostgreSQL database (version 14 or higher) with your preferred cloud database provider (such as AWS RDS, DigitalOcean, Supabase, Neon, Railway, or a self-hosted database).

2. **Create a Database User and Password:**
   * Set up a dedicated database user with a strong password.
   * Ensure this user has full read and write permissions (including `CREATE`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`) on the `public` schema of the target database.

3. **Obtain the Connection URL:**
   * Copy the connection URL provided by your database dashboard.
   * Standard connection string format:
     ```text
     postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public
     ```
   * **SSL Configuration:** Follow the SSL recommendation of your database provider. Many managed cloud providers require an SSL query parameter (such as `sslmode=require`), while some internal or private networks do not. Configure SSL according to your provider's documentation.

4. **Environment Variable:**
   * Securely provide this connection string as the following variable:
     * `DATABASE_URL`

### Deployment notes
* The client selects a managed PostgreSQL provider and region, creates a dedicated application user with privileges required by Prisma migrations and runtime, and securely configures `DATABASE_URL`.
* The client deploys the complete source checkout, applies checked-in migrations with `cd backend` then `npm run migrate`, and chooses either the Admin CMS catalogue transfer or the separately documented guarded baseline seed. Never use a migration reset command against production.
* Use the provider's recommended TLS settings and verify the database backup/restore procedure before launch. The local Docker PostgreSQL setup is for development/testing only.

---

## 2. Cloudflare R2 Storage Setup

Cloudflare R2 provides S3-compatible cloud object storage for product images and website media.

### Step-by-Step Instructions:

1. **Create or Log In to Cloudflare:**
   * Go to the [Cloudflare Dashboard](https://dash.cloudflare.com) and sign in.

2. **Navigate to R2:**
   * In the main dashboard sidebar, select **R2**.

3. **Create a Storage Bucket:**
   * Click **Create bucket**.
   * Enter a bucket name (for example, `icon-electromatic-media`).
   * Select your preferred storage region.
   * **Keep the bucket access Private by default.** Uploads are mediated by the authenticated backend; R2 credentials remain server-side.

4. **Generate R2 API Credentials:**
   * On the main R2 page, click **Manage R2 API Tokens** on the right side.
   * Click **Create API Token**.
   * Token name: enter an identifier (for example, `Icon Electromatic Website`).
   * Permissions: select **Object Read & Write**.
   * Under "Apply to specific buckets", choose the bucket you created in Step 3.
   * Click **Create API Token**.

5. **Record Your Credentials:**
   * Copy the following values immediately (the secret key is only displayed once):
     * **Account ID:** Found on your Cloudflare R2 overview page.
     * **Access Key ID:** 32-character string.
     * **Secret Access Key:** 64-character string.
     * **Bucket Name:** The name you chose in Step 3.
     * **S3 Endpoint:** Formatted as `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

6. **Optional Public Custom Domain:**
   * The default delivery path uses `GET /api/media/file/:id`; the backend streams from the private bucket or falls back to a short-lived signed URL.
   * Only configure a public custom domain if the client explicitly wants public object delivery. The route redirects to that host when `R2_PUBLIC_DOMAIN` is set; ensure the domain serves uploaded object keys and understand that this changes the private-bucket delivery model.

### Environment Variables to Provide:
* `R2_ACCOUNT_ID`
* `R2_ACCESS_KEY_ID`
* `R2_SECRET_ACCESS_KEY`
* `R2_BUCKET_NAME`
* `R2_ENDPOINT`
* `R2_PUBLIC_DOMAIN` (Optional: only if public CDN custom domain was configured in Step 6)

---

## 3. Resend Email Service Setup

Resend sends customer quotation requests (RFQs), contact enquiries, and career applications directly to your company inbox.

### Step-by-Step Instructions:

1. **Create a Resend Account:**
   * Sign up at [Resend](https://resend.com).

2. **Add Your Corporate Domain:**
   * In the Resend dashboard, navigate to **Domains** > **Add Domain**.
   * Enter your corporate domain (for example, `iconelectromatic.com`).
   * Select the sending region appropriate for the client's needs and account configuration.

3. **Configure DNS Records:**
   * Follow the exact record names, types, and values shown for the domain in the client's own Resend account and selected region. Do not assume a fixed number or type of records.
   * Coordinate SPF and DMARC with the existing mail/DNS administrator. Avoid duplicate SPF records and do not replace inbound MX or other mail-security records unless the responsible administrator has reviewed the change.

4. **Add Records to Your DNS Provider:**
   * Log in to the DNS management portal for your domain (such as Cloudflare DNS, GoDaddy, Namecheap, or AWS Route 53).
   * Add each record exactly as specified in the Resend dashboard.

5. **Complete Domain Verification:**
   * Return to the Resend dashboard and confirm that the domain status shows **Verified**.
   * **Important:** The email service cannot be considered ready until the sending domain is verified. Unverified domains will fail to send emails in production.

6. **Generate an API Key:**
   * Navigate to **API Keys** > **Create API Key**.
   * Name: `Icon Electromatic Production`.
   * Permission: **Sending access**.
   * Select your verified domain (or all domains).
   * Click **Add** and copy the generated key (starts with `re_`).

7. **Determine Email Addresses & Regional Mailbox Requirements:**
   * **Sender Address (`RESEND_FROM_EMAIL`):** Must be allowed by the verified domain and account configuration. This is the application's primary sender variable; `ENQUIRY_FROM` is a legacy fallback only.
   * **Primary Fallback Recipient (`CONTACT_EMAIL`):** The company inbox where career applications and general enquiries with unselected regions arrive (for example, `sales@iconelectromatic.com`).
   * **Regional Sales Mailboxes (Corporate Mail Server Setup):**
     The application automatically routes enquiries based on customer region. The client must ensure these mailboxes or email aliases exist and can receive external mail on the corporate mail system:
     * **India HQ (Bengaluru):** `salesiepl@iconelectromatic.com`
     * **Singapore Liaison Office:** `IESing@iconelectromatic.com`
     * **USA Liaison Office:** `salesiellc@iconelectromatic.com`

### Existing Application Functionality vs. Client Configuration

To avoid confusion during handover, note what the codebase already handles versus what the client must configure:

* **Built into the Application (Completed & Ready):**
  * Automated regional enquiry routing based on customer selection.
  * Durable database pre-commit saving in PostgreSQL before email dispatch.
  * Branded customer acknowledgement delivery dispatched strictly after internal notification succeeds.
  * Suppression of customer acknowledgements on honeypot/spam or delivery failure.
  * Zero exposure of internal regional sales addresses to customers.
  * Chronological communication audit logging and dual CSV export generation.
* **Client Responsibilities (External Infrastructure):**
  * Provisioning the PostgreSQL database and providing `DATABASE_URL`.
  * Creating a bucket-scoped Cloudflare R2 credential and configuring it only in the backend secret store.
  * Verifying the `iconelectromatic.com` sending domain in Resend and providing `RESEND_API_KEY`.
  * Ensuring `salesiepl@...`, `IESing@...`, `salesiellc@...`, and `CONTACT_EMAIL` exist on your corporate mail server.

### Environment Variables to Provide:
* `RESEND_API_KEY`
* `RESEND_FROM_EMAIL`
* `CONTACT_EMAIL`

---

## Summary Checklist for Technical Team Handover

Once all three services are created, provide the following configuration values securely to your technical deployment team:

| Service | Variable Name | Description | Example (Placeholder) |
|---|---|---|---|
| **PostgreSQL** | `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname?schema=public` |
| **Cloudflare R2** | `R2_ACCOUNT_ID` | Cloudflare account identifier | Client-provided; optional to application configuration |
| **Cloudflare R2** | `R2_ACCESS_KEY_ID` | Bucket-scoped S3 API key ID | Store as a backend secret |
| **Cloudflare R2** | `R2_SECRET_ACCESS_KEY` | Bucket-scoped S3 API secret | Store as a backend secret |
| **Cloudflare R2** | `R2_BUCKET_NAME` | Client-selected bucket | Keep private by default |
| **Cloudflare R2** | `R2_ENDPOINT` | S3 API endpoint URL | Obtain/derive from client account |
| **Cloudflare R2** | `R2_PUBLIC_DOMAIN` | *(Optional)* Public media domain | Only if client enables public object delivery |
| **Resend** | `RESEND_API_KEY` | Resend API sending key | Store as a backend secret |
| **Resend** | `RESEND_FROM_EMAIL` | Sender on verified domain | Primary sender setting |
| **Resend** | `CONTACT_EMAIL` | Fallback recipient inbox | Client-approved receiving mailbox |
| **Corporate Mail Server** | *(Mailbox)* | India sales recipient | `salesiepl@iconelectromatic.com` |
| **Corporate Mail Server** | *(Mailbox)* | Singapore sales recipient | `IESing@iconelectromatic.com` |
| **Corporate Mail Server** | *(Mailbox)* | USA sales recipient | `salesiellc@iconelectromatic.com` |
