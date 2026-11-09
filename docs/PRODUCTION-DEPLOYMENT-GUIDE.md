# Production Deployment & Security Configuration Guide

**Project:** Icon Electromatic B2B Catalog & CMS  
**Document Version:** 1.0  
**Scope:** Client-operated production hosting, backend/API routing, PostgreSQL, Cloudflare R2, Resend, and security configuration.

**Deployment status:** Guidance only. The client chooses providers and performs
deployment. No production host, database, DNS, email, or R2 configuration has
been accessed or validated by the development team.

---

## 1. Security Architecture Overview

The Icon Electromatic backend is built with hardened production defenses designed to protect administrative operations, catalog data integrity, and customer enquiries.

```
[ Client Browser / Admin User ]
             │
             ▼  HTTPS (TLS 1.3)
[ Static Host / Reverse Proxy / CDN (client-selected) ]
             │
             ▼  Private Network / Filtered Headers (verified TRUST_PROXY setting)
[ Node.js 22 / Express API Server ]
    ├── Helmet Security Headers (nosniff, HSTS, SAMEORIGIN, CORP: cross-origin)
    ├── CORS Validation (Strict FRONTEND_URL matching in production)
    ├── Rate Limiting (IP & Email independent buckets, reset on success)
    ├── Dual-token Session & CSRF Validation (__Host- cookies + SHA-256 DB check)
    └── Safe Error Handling (Internal details masked, CORS 403, Payload 413)
             │
             ├── [ Managed PostgreSQL (Prisma ORM) ]
             ├── [ Cloudflare R2 Object Storage (Private Bucket) ]
             └── [ Resend API (Transactional Enquiry Email) ]
```

---

## 2. Required Production Environment Variables

Never commit `.env` files to Git. Configure backend variables in the
client-selected Node.js hosting service's secret/config store. Build the
frontend from the repository root. The backend needs the complete repository
checkout, including `shared/`. CI uses Node.js 22. Production Docker
infrastructure is not required.

| Variable Name | Required | Example / Format | Purpose | Security Notes |
|---|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production mode | Enforces `__Host-` cookies, `Secure` flags, and strict CORS. |
| `PORT` | Provider-dependent | Provider-assigned port; app default `5000` | Server listening port | Use the port required by the selected host. |
| `FRONTEND_URL` | **Yes** | `https://iconelectromatic.com,https://www.iconelectromatic.com` | Allowed CORS origins | In production, **only** origins listed here are accepted. Localhost is blocked. |
| `TRUST_PROXY` | Topology-dependent | Exact trusted proxy configuration | Express proxy trust used for client IP resolution | Configure from the selected provider's documented forwarding chain. Do not copy a generic value or trust client-supplied forwarding headers. |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db?schema=public` | Prisma PostgreSQL connection | Use SSL mode (`sslmode=require`) in cloud hosting. |
| `RESEND_API_KEY` | Required for live email | Secret from Resend | Resend sending API key | Keep in the backend secret store; use least privilege available. |
| `RESEND_FROM_EMAIL` | Required for live email | Sender on verified domain | Outgoing email sender | Primary setting. `ENQUIRY_FROM` is a legacy fallback only. |
| `CONTACT_EMAIL` | Required for live email | Client-approved fallback inbox | Recipient for general enquiries and career applications | Confirm mailbox with client stakeholders. |
| `R2_ACCOUNT_ID` | Optional in app config | Cloudflare account identifier | Account reference | Endpoint is separately configured in `R2_ENDPOINT`. |
| `R2_ACCESS_KEY_ID` | Required for R2 | Secret from provider | R2 S3 API access key | Scope to the application bucket. |
| `R2_SECRET_ACCESS_KEY` | Required for R2 | Secret from provider | R2 S3 API secret | Never expose to frontend build configuration. |
| `R2_BUCKET_NAME` | Required for R2 | Client-selected bucket | R2 bucket name | Prefer private access; app uploads and retrieves through backend. |
| `R2_ENDPOINT` | **Yes** | `https://<ID>.r2.cloudflarestorage.com` | R2 S3 compatibility endpoint | Cloudflare S3 endpoint URL. |
| `R2_PUBLIC_DOMAIN` | Optional | Client-configured HTTPS domain | Public media domain | When configured, media delivery redirects there; otherwise the backend streams from the private bucket or uses a short-lived signed URL fallback. |

`SITE_ORIGIN` configures the backend's canonical sitemap origin.
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are temporary inputs for non-interactive
admin provisioning. `PRODUCTION_DATABASE_URL` is used only by the optional
production catalogue seeder. `VITE_API_BASE_URL` and `VITE_SITE_ORIGIN` are
frontend build-time variables; `window.__ICON_API_BASE__` is a runtime override,
not an environment variable.

---

## 3. Deployment Settings & Topology

### Reverse Proxy & `TRUST_PROXY`
1. **Direct Connection (Development / Self-hosted without reverse proxy):**
   * Set `TRUST_PROXY=false` or leave blank.
   * Express will derive client IP directly from `req.socket.remoteAddress`, preventing IP spoofing via attacker-supplied `X-Forwarded-For` headers.
2. **Behind a reverse proxy or managed platform:**
   * First verify that the backend is reachable only through the intended
     proxy and that the proxy removes or overwrites client-supplied forwarding
     headers with its own trusted values.
   * Then configure `TRUST_PROXY` to match only that verified proxy topology,
     using provider-documented addresses or a reviewed hop configuration.
     Never trust arbitrary forwarded headers, set `TRUST_PROXY=true`, or copy
     a hop count/subnet example without proving the network path and header
     sanitization. Incorrect trust can enable spoofed client IPs and undermine
     IP-based rate limits.
3. **Unknown or unverified topology:**
   * Leave `TRUST_PROXY` unset or set it to `false` until the actual proxy and
     header behavior have been verified. This may cause the application to see
     the proxy address rather than the visitor address, but avoids trusting
     unverified forwarding headers.

### Domain strategy & cookie scope
To guarantee seamless session management and CSRF defense:
* **Recommended Architecture (Same-Origin Reverse Proxy):**
  * Serve the frontend at `https://iconelectromatic.com` and reverse-proxy `/api/*` to the backend.
  * In this configuration, requests are same-origin. Cookies use the `__Host-` prefix (`__Host-admin_session`, `__Host-admin_csrf`) with `SameSite=Lax; Secure; Path=/`.
* A separate API subdomain without a same-origin proxy is not the recommended
  setup for this cookie model. Review authentication and CORS behavior before
  choosing a different topology.

### Vercel frontend routing

The current [vercel.json](../vercel.json) defines the build command/output,
rewrites `/sitemap.xml` to same-origin `/api/sitemap.xml`, and sends other
unmatched paths to `/index.html`. It does not configure a backend API origin or
an `/api/*` rewrite to a separate Node.js service. After the client chooses the
backend host, add an explicit API rewrite before the SPA catch-all, preserving
the `/api/...` path. Route `/sitemap.xml` to the backend's dynamic sitemap route
as well. The rewrite destination is a deployment decision and is deliberately
left as a placeholder here; do not deploy an unresolved placeholder.

### Optional Nginx template

The copyable placeholder-based configuration is
[Nginx template](./templates/nginx.conf.example). It routes
the SPA/static files, `/api/`, and `/sitemap.xml` through one HTTPS origin.
Replace the domain, private backend address/port, deployed `dist/` path, and TLS
certificate paths. Restrict backend network access to the proxy and set
`TRUST_PROXY` only to match the verified proxy chain. If a CDN is in front,
configure its trusted real-client-IP handling before relying on IP-based rate
limits. The client must review TLS policy, security headers, upload/proxy
timeouts, and certificate renewal before use.

---

### Build, migration, and startup commands

Run these commands in the client's approved deployment environment, after
confirming the target services and secrets:

```bash
# Repository root: install frontend dependencies and build static output
npm ci
npm run build

# Backend package: install dependencies, apply pending Prisma migrations, start
cd backend
npm ci
npm run migrate
npm start
```

`npm run migrate` executes `prisma migrate deploy`; it applies checked-in
migrations and does not reset the database. Back up and verify the target before
running it. The backend start command is `npm start` (`node src/server.js`).

Provision the first admin interactively from `backend/`:

```bash
node scripts/provision-admin.js
```

For non-interactive provisioning, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` through
the provider's secret store and run from `backend/`:

```bash
node scripts/provision-admin.js --non-interactive
```

Never put the password in arguments or logs.

The optional baseline seed command is `npm run seed:production-catalog` from
`backend/`. It performs read-only inspection by default. Applying requires
`PRODUCTION_DATABASE_URL`, `--apply`, and an exact explicit target confirmation;
it refuses local/test targets and does not replace an existing catalogue. See
the safety steps in [CLIENT-HANDOVER-GUIDE.md](./CLIENT-HANDOVER-GUIDE.md) before
using it. The seeder requires `sslmode=verify-full` to authenticate the server
certificate and hostname; this stricter requirement applies to
`PRODUCTION_DATABASE_URL`, separately from the runtime `DATABASE_URL` guidance
above.

See [DISASTER-RECOVERY-RUNBOOK.md](./DISASTER-RECOVERY-RUNBOOK.md) for client-
authorized backup, restore, migration incident, and recovery verification
procedures. For field definitions and database relationships, see
[DATA-DICTIONARY.md](./DATA-DICTIONARY.md).

## 4. Hardened Security Defenses

### 1. HTTP Security Headers (Helmet)
* `X-Content-Type-Options: nosniff`: Prevents browsers from MIME-sniffing away from the declared content type.
* `Strict-Transport-Security` (HSTS): Enforces HTTPS connections (`max-age=15552000; includeSubDomains`).
* `X-Frame-Options: SAMEORIGIN`: Defends administrative interfaces against clickjacking attacks.
* `Cross-Origin-Resource-Policy: cross-origin`: Permits frontend pages on separate origins to load product images served by `/api/media/file/:id`.
* `X-Powered-By`: Suppressed entirely to avoid advertising Express framework versions.

### 2. Login Rate Limiting & Account Lockout Defense
* **IP-based Limit**: 5 failed login attempts per IP within a 15-minute window.
* **Account-based Limit**: 5 failed login attempts per normalized email within an independent 15-minute window. This stops distributed credential-stuffing attacks where an attacker rotates IP addresses against a single administrator account.
* **Reset on Successful Authentication**: The failure counter is cleared immediately upon successful login, ensuring legitimate administrators entering valid credentials are never locked out.

### 3. Safe Error Handling
* Express global error handler suppresses stack traces and database error internals on all 500 responses.
* CORS rejections return HTTP `403 Forbidden` with a clean JSON payload (`{ "success": false, "message": "CORS request forbidden: origin not allowed." }`) without logging server-side 500 error alerts.
* Payload limits are enforced at 250 KB (`express.json({ limit: "250kb" })`), rejecting oversized payloads with HTTP 413.

### 4. Media Storage Security
* Cloudflare R2 bucket is kept strictly private.
* All uploaded files are inspected via magic bytes (`validateImageBuffer` supporting JPEG, PNG, WebP, GIF) and enforced under 10 MB.
* Media files are stored using unguessable random UUIDs and SHA-256 digests (`generateObjectKey`), preventing directory traversal or overwrites.
* Delivery route `GET /api/media/file/:id` serves cached binary streams with `Cache-Control: public, max-age=86400, immutable`.

---

## 5. Pre-Launch Verification Checklist

Before pointing production DNS to the servers:

- [ ] `NODE_ENV=production` is set in the hosting provider dashboard.
- [ ] `FRONTEND_URL` is set to the exact production domain(s) with `https://`.
- [ ] `TRUST_PROXY` is configured for the verified trusted proxy chain, not copied from a generic example.
- [ ] PostgreSQL connection string uses `sslmode=require` and a dedicated non-superuser database account.
- [ ] Cloudflare R2 bucket remains private unless the client intentionally configures `R2_PUBLIC_DOMAIN`; backend upload/delivery is verified without exposing credentials.
- [ ] Resend domain is verified using the exact records shown in the client's account; SPF/DMARC changes are coordinated with the mail administrator.
- [ ] Backend migrations ran with `npm run migrate` only after verifying the target and backup.
- [ ] The first admin was provisioned through the interactive or secret-store-based non-interactive command; temporary provisioning secrets are removed.
- [ ] `backend/.env` is NOT tracked in Git (`git status` clean).
- [ ] Frontend production build (`npm run build`) succeeds and publishes the generated `dist/` output.
- [ ] `/api/*` and `/sitemap.xml` reach the backend through the same public origin; the SPA fallback does not serve HTML to API requests.
- [ ] DNS points to the chosen frontend host, HTTPS certificates are valid, and HTTP redirects to HTTPS.
