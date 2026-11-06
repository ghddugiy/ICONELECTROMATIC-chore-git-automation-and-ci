# External Service Setup Guide

This document explains how to create and configure the three external cloud services required to operate the Icon Electromatic website:

1. **PostgreSQL Database** (Product catalog, customer enquiries, CMS content)
2. **Cloudflare R2 Storage** (Persistent image and media storage)
3. **Resend Email Service** (Contact enquiries and career application notifications)

This is a service setup guide, not a hosting or deployment guide. Once you have created these services, provide the resulting credentials securely to your technical deployment team.

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

### What the Technical Team Will Do With This Service:
* **Apply Database Schema:** The technical team will use the `DATABASE_URL` to apply the existing Prisma database migrations (`npm run migrate`), which create all required tables and indexes automatically.
* **Seed Product Catalog:** Once the database tables are ready and an administrator account is provisioned, the initial catalog (15 OEMs, 88 categories, and 169 products) will be imported through the website's built-in Admin CMS catalog transfer feature.

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
   * **Keep the bucket access Private by default.** The application connects to R2 securely using S3 API credentials and delivers images safely.

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

6. **Optional Public Custom Domain (CDN Delivery):**
   * By default, the backend streams images directly from the private bucket.
   * If you wish to serve images directly through Cloudflare's CDN for higher performance, navigate to your bucket's **Settings** > **Public Access** > **Custom Domains**, and connect a custom subdomain (for example, `media.iconelectromatic.com`).
   * This step is optional. If configured, provide the URL as `R2_PUBLIC_DOMAIN`.

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
   * Select your preferred sending region.

3. **Configure DNS Records:**
   * Resend will provide three DNS records:
     * **SPF** (TXT record to authorize Resend as a sender)
     * **DKIM** (TXT / CNAME records to cryptographically sign your emails)
     * **MX** / DMARC verification records

4. **Add Records to Your DNS Provider:**
   * Log in to the DNS management portal for your domain (such as Cloudflare DNS, GoDaddy, Namecheap, or AWS Route 53).
   * Add each record exactly as specified in the Resend dashboard.

5. **Complete Domain Verification:**
   * Return to the Resend dashboard and click **Verify Domain**.
   * Confirm that the domain status shows **Verified**.
   * **Important:** The email service cannot be considered ready until the sending domain is verified. Unverified domains will fail to send emails in production.

6. **Generate an API Key:**
   * Navigate to **API Keys** > **Create API Key**.
   * Name: `Icon Electromatic Production`.
   * Permission: **Sending access**.
   * Select your verified domain (or all domains).
   * Click **Add** and copy the generated key (starts with `re_`).

7. **Determine Email Addresses & Regional Mailbox Requirements:**
   * **Sender Address (`RESEND_FROM_EMAIL`):** Must use your verified corporate domain (for example, `notifications@iconelectromatic.com` or `sales@iconelectromatic.com`). Customer acknowledgement emails and internal notifications are dispatched from this address.
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
  * Creating the Cloudflare R2 bucket and providing API credentials.
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
| **Cloudflare R2** | `R2_ACCOUNT_ID` | Cloudflare account identifier | `a1b2c3d4e5f67890abcdef1234567890` |
| **Cloudflare R2** | `R2_ACCESS_KEY_ID` | S3 API token access key | `0123456789abcdef0123456789abcdef` |
| **Cloudflare R2** | `R2_SECRET_ACCESS_KEY` | S3 API token secret key | `fedcba9876543210fedcba9876543210fedcba98...` |
| **Cloudflare R2** | `R2_BUCKET_NAME` | Private bucket name | `icon-electromatic-media` |
| **Cloudflare R2** | `R2_ENDPOINT` | S3 API endpoint URL | `https://a1b2c3d4e5f67890abcdef1234567890.r2.cloudflarestorage.com` |
| **Cloudflare R2** | `R2_PUBLIC_DOMAIN` | *(Optional)* Public CDN domain | `https://media.iconelectromatic.com` |
| **Resend** | `RESEND_API_KEY` | Resend API sending key | `re_123456789_abcdefghijklmnopqrstuv` |
| **Resend** | `RESEND_FROM_EMAIL` | Sender on verified domain | `notifications@iconelectromatic.com` |
| **Resend** | `CONTACT_EMAIL` | Fallback recipient inbox | `sales@iconelectromatic.com` |
| **Corporate Mail Server** | *(Mailbox)* | India sales recipient | `salesiepl@iconelectromatic.com` |
| **Corporate Mail Server** | *(Mailbox)* | Singapore sales recipient | `IESing@iconelectromatic.com` |
| **Corporate Mail Server** | *(Mailbox)* | USA sales recipient | `salesiellc@iconelectromatic.com` |
