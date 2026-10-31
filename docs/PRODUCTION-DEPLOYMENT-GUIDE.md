# Production Deployment & Security Configuration Guide

**Project:** Icon Electromatic B2B Catalog & CMS  
**Document Version:** 1.0  
**Scope:** Backend Express API, Authentication, Cloudflare R2 Media, Resend Enquiries, and Production Security Hardening.

---

## 1. Security Architecture Overview

The Icon Electromatic backend is built with hardened production defenses designed to protect administrative operations, catalog data integrity, and customer enquiries.

```
[ Client Browser / Admin User ]
             │
             ▼  HTTPS (TLS 1.3)
[ Reverse Proxy / CDN (e.g., Cloudflare / Vercel / Nginx) ]
             │
             ▼  Private Network / Filtered Headers (TRUST_PROXY=1)
[ Express API Server ]
    ├── Helmet Security Headers (nosniff, HSTS, SAMEORIGIN, CORP: cross-origin)
    ├── CORS Validation (Strict FRONTEND_URL matching in production)
    ├── Rate Limiting (IP & Email independent buckets, reset on success)
    ├── Dual-token Session & CSRF Validation (__Host- cookies + SHA-256 DB check)
    └── Safe Error Handling (Internal details masked, CORS 403, Payload 413)
             │
             ├── [ Local / Managed PostgreSQL (Prisma ORM) ]
             ├── [ Cloudflare R2 Object Storage (Private Bucket) ]
             └── [ Resend API (Transactional Enquiry Email) ]
```

---

## 2. Required Production Environment Variables

Never commit `.env` files to Git. Configure these variables directly in your production hosting platform (e.g. Railway, Render, AWS ECS, or Vercel).

| Variable Name | Required | Example / Format | Purpose | Security Notes |
|---|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production mode | Enforces `__Host-` cookies, `Secure` flags, and strict CORS. |
| `PORT` | **Yes** | `5000` | Server listening port | Ensure port is internal or proxied; not directly exposed if behind Nginx. |
| `FRONTEND_URL` | **Yes** | `https://iconelectromatic.com,https://www.iconelectromatic.com` | Allowed CORS origins | In production, **only** origins listed here are accepted. Localhost is blocked. |
| `TRUST_PROXY` | **Yes** | `1` | Number of upstream proxy hops | Set to `1` behind a single reverse proxy (Vercel, Render, Railway, AWS ALB). Never set `true` without header sanitization. |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/db?schema=public` | Prisma PostgreSQL connection | Use SSL mode (`sslmode=require`) in cloud hosting. |
| `RESEND_API_KEY` | **Yes** | `re_abc123...` | Resend API key | Keep secret. Restrict permissions to sending only. |
| `ENQUIRY_FROM` | **Yes** | `sales@iconelectromatic.com` | Outgoing email sender | Must match a verified domain in Resend. |
| `CONTACT_EMAIL` | **Yes** | `info@iconelectromatic.com` | Inbox receiving form submissions | Confirm destination mailbox with client stakeholders. |
| `R2_ACCOUNT_ID` | **Yes** | `32-character hex string` | Cloudflare account ID | Found in Cloudflare R2 dashboard. |
| `R2_ACCESS_KEY_ID` | **Yes** | `32-character string` | R2 S3 API access key | Generated via Cloudflare R2 API Tokens. |
| `R2_SECRET_ACCESS_KEY` | **Yes** | `64-character string` | R2 S3 API secret key | Generated via Cloudflare R2 API Tokens. |
| `R2_BUCKET_NAME` | **Yes** | `icon-electromatic-media` | Cloudflare R2 bucket name | Bucket should remain private. |
| `R2_ENDPOINT` | **Yes** | `https://<ID>.r2.cloudflarestorage.com` | R2 S3 compatibility endpoint | Cloudflare S3 endpoint URL. |
| `R2_PUBLIC_DOMAIN` | Optional | `https://media.iconelectromatic.com` | Public CDN URL for assets | If omitted, backend streams media directly or signs 15-minute URLs. |

---

## 3. Deployment Settings & Topology

### Reverse Proxy & `TRUST_PROXY`
1. **Direct Connection (Development / Self-hosted without reverse proxy):**
   * Set `TRUST_PROXY=false` or leave blank.
   * Express will derive client IP directly from `req.socket.remoteAddress`, preventing IP spoofing via attacker-supplied `X-Forwarded-For` headers.
2. **Behind Single Reverse Proxy (Cloudflare / Vercel / Railway / Render / AWS ALB):**
   * Set `TRUST_PROXY=1`.
   * Express trusts the last IP added by the front-facing proxy, accurately tracking client IPs for rate limiting.
3. **Multi-hop / Private Subnets:**
   * Set `TRUST_PROXY=loopback,10.0.0.0/8` to explicitly trust specific internal proxy subnets.

### Domain Strategy & Cookie Scope
To guarantee seamless session management and CSRF defense:
* **Recommended Architecture (Same-Origin Reverse Proxy):**
  * Serve the frontend at `https://iconelectromatic.com` and reverse-proxy `/api/*` to the backend.
  * In this configuration, requests are same-origin. Cookies use the `__Host-` prefix (`__Host-admin_session`, `__Host-admin_csrf`) with `SameSite=Lax; Secure; Path=/`.
* **Cross-Subdomain Architecture (`iconelectromatic.com` and `api.iconelectromatic.com`):**
  * Allowed in modern browsers because both origins share the parent registrable domain.
  * Ensure `FRONTEND_URL` contains `https://iconelectromatic.com`.

---

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
- [ ] `TRUST_PROXY` is configured according to the hosting environment (`1` for standard PaaS).
- [ ] PostgreSQL connection string uses `sslmode=require` and a dedicated non-superuser database account.
- [ ] Cloudflare R2 bucket is private and CORS rules on R2 allow image rendering.
- [ ] Resend sender domain `iconelectromatic.com` has verified DNS records (SPF, DKIM, DMARC).
- [ ] `backend/.env` is NOT tracked in Git (`git status` clean).
- [ ] Automated security test suite (`node --test`) passes with 100% success.
- [ ] Frontend production build (`npm run build`) builds clean without errors.

