# Cloudflare R2 Image Storage Integration Strategy

**Document Status:** Architectural Specification & Migration Plan (Phase 1 / Future Implementation)  
**Target Storage Engine:** Cloudflare R2 (S3-compatible object storage)  
**Current State:** In-browser IndexedDB (`idb:img_...`) and static repository assets (`/images/...`, `/PICTURES/...`)

---

## 1. Executive Summary & Objectives

The Icon Electromatic website is a high-reliability B2B catalog displaying RF, microwave, and electronic components from 15 global OEM partners. Currently:
1. Production and development images are served from local static repository paths (`/images/products/...`, `/images/oem-logos/...`).
2. Client-side CMS uploads are temporarily stored as binary blobs in browser IndexedDB (`IconElectromatic_CMS` database, `cms_images` object store) via `ImageStorage.js`.
3. The Prisma PostgreSQL schema defines `MediaAsset` and `ProductMedia` models ready for cloud storage metadata, but R2 file synchronization has not yet been enabled.

**Goal:** Establish an enterprise-grade, cost-effective, durable image storage system powered by Cloudflare R2. R2 eliminates egress fees, offers global CDN distribution, and maintains standard S3 API compatibility.

---

## 2. Current Architecture & Preservation Guarantee

### Current Local Image Flow
- **Static Assets:** Hardcoded references like `/images/oem-logos/Rogers_Logo_no_bg.png` or `/images/products/image1.jpeg` resolve directly via Vite's public asset pipeline.
- **IndexedDB Blobs:** New uploads created in the CMS receive keys formatted as `idb:img_<timestamp>_<random>`.
- **Runtime Resolution:** `ImageStorage.resolveImageUrl(urlOrId)` detects `idb:` identifiers, generates in-memory `URL.createObjectURL(blob)`, and swaps `<img src>` synchronously.
- **Preservation Rule:** In this phase, **no IndexedDB data is purged**, and no static assets are removed or altered. The existing local image resolution remains 100% active.

### PostgreSQL Database Schema Alignment
The PostgreSQL schema migration (`20261019233400_add_cms_backend_schema`) provides the exact tables needed for R2 assets:
- **`MediaAsset`**:
  - `id`: Unique cuid identifier.
  - `r2Key`: S3 object key (e.g. `products/rogers-5880-laminate.jpg`).
  - `publicUrl`: Full public CDN HTTPS URL.
  - `mimeType`: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`.
  - `byteSize`: File size in bytes.
  - `sha256`: 64-character SHA-256 hex digest for content-addressable deduplication.
  - `status`: `PENDING`, `ACTIVE`, `RETIRED`, `FAILED`.
  - `uploadedById`: Relation to `AdminUser`.
- **`ProductMedia`**:
  - `productId`: References `Product.id`.
  - `mediaAssetId`: References `MediaAsset.id`.
  - `sortOrder`: Display sequence in product galleries.
  - `altText`: Accessibility text for SEO.
  - `isPrimary`: Boolean flag indicating primary catalog thumbnail.

---

## 3. Cloudflare R2 Target Architecture

```
┌────────────────────────┐         Direct S3 API           ┌────────────────────────┐
│  Express Backend API   │ ──────────────────────────────> │      Cloudflare R2     │
│   (S3 Client SDK)      │                                 │   Object Storage Bucket│
└────────────────────────┘                                 └────────────────────────┘
            ▲                                                          │
            │ Credentials &                                            │ Public CDN Cache
            │ Upload Auth                                              ▼
┌────────────────────────┐       Public HTTPS URL          ┌────────────────────────┐
│ Admin CMS / Browser    │ <────────────────────────────── │   Custom Domain / CDN  │
│ (Vite + Vanilla JS)    │                                 │ media.iconelectromatic │
└────────────────────────┘                                 └────────────────────────┘
```

### Bucket Configuration
- **Bucket Name:** `icon-electromatic-media` (separate buckets for staging/production via environment variables).
- **Public Access:** Enabled via custom domain (e.g., `https://media.iconelectromatic.com` or Cloudflare managed R2 domain).
- **Security:** R2 API credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) are kept exclusively on the Express backend; **never exposed to frontend code**.

---

## 4. Ingestion & Upload Workflows

### A. Upload Ingestion Strategy (Backend Presigned URL)
To prevent proxying heavy file payloads through the Node.js process and exhausting server memory:
1. **Initiate Upload:**
   - Admin CMS sends `POST /api/media/upload-intent` with `{ fileName, mimeType, byteSize, sha256 }`.
   - Backend authenticates the admin session (`requireAdmin` + CSRF verification).
   - Backend validates the file type (JPEG, PNG, WebP, SVG only) and maximum size (e.g., 5 MB).
   - Backend checks if `MediaAsset` with matching `sha256` already exists (deduplication). If found, returns existing `publicUrl`.
   - Backend generates a pre-signed S3 `PutObjectCommand` URL with a short expiration (10 minutes) and creates a `MediaAsset` record with status `PENDING`.
2. **Direct Browser Upload:**
   - Frontend `fetch(presignedUrl, { method: 'PUT', body: fileBlob, headers: { 'Content-Type': mimeType } })` pushes the asset directly to R2.
3. **Confirm & Activate:**
   - Frontend calls `POST /api/media/confirm-upload` with `{ mediaAssetId }`.
   - Backend verifies object existence and metadata in R2 (via `HeadObjectCommand`), sets `status = ACTIVE`, and links `ProductMedia`.

---

## 5. Migration Strategy for Existing Assets

### Phase 1: Repository Static Asset Ingestion
A Node.js maintenance script (`backend/scripts/migrate-local-images-to-r2.js`) will:
1. Scan local image directories (`/public/images/products`, `/public/images/oem-logos`).
2. Calculate the SHA-256 checksum and MIME type of each file.
3. Upload to R2 with structured keys:
   - `oem-logos/{sha256[:12]}-{fileName}`
   - `products/{sha256[:12]}-{fileName}`
4. Create corresponding `MediaAsset` records and update `sourceImagePath` / `ProductMedia`.
5. Run in a dry-run preview mode before writing any data.

### Phase 2: IndexedDB Client Asset Migration
For images created during demo admin usage:
1. Upon admin authentication, `ImageStorage` checks for unsynchronized `idb:` keys.
2. The CMS prompts the admin with a synchronization preview: `"3 images stored in your local browser can be uploaded to persistent cloud storage."`
3. Upon approval, blobs are extracted from IndexedDB, uploaded via the pre-signed URL workflow, and their `idb:` keys in catalog records are replaced with persistent `https://media.iconelectromatic.com/...` URLs.
4. The local IndexedDB copy is kept as a cached fallback until confirmed live.

---

## 6. Image Replacement & Deletion Strategy

- **Immutability:** Cloudflare R2 objects are named content-addressably using their SHA-256 hash or unique cuid. Updating an image creates a new object rather than overwriting in place, preventing CDN cache invalidation race conditions.
- **Soft Deletion / Retirement:**
  - When an admin removes an image from a product, the `ProductMedia` link is deleted.
  - The underlying `MediaAsset` is marked `status = RETIRED`.
  - A scheduled lifecycle job purges `RETIRED` assets older than 30 days, ensuring accidental deletions can be reversed without data loss.

---

## 7. Rollback & Disaster Recovery Strategy

1. **R2 Bucket Object Versioning:**
   - Enable object versioning on the R2 bucket so accidental overwrites or deletes retain past versions.
2. **Database Reversion:**
   - Since `sourceImagePath` stores the fallback relative path, any failure in R2 delivery allows the frontend to fall back to local assets transparently.
3. **Local Cache Fallback:**
   - `ImageStorage.resolveImageUrl(url)` will inspect URLs:
     - If starts with `https://media.iconelectromatic.com`: Loads from R2 CDN.
     - If CDN request triggers `onerror`: Automatically falls back to repository `/images/...` fallback.
     - If starts with `idb:`: Loads from local IndexedDB.

---

## 8. Implementation Checklist for Phase 2

- [ ] Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` in `backend/package.json`.
- [ ] Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_PUBLIC_BASE_URL` to `.env.example`.
- [ ] Create `backend/src/services/r2Storage.js` with S3 client initialization.
- [ ] Implement `POST /api/media/upload-intent` and `POST /api/media/confirm-upload` routes with `requireAdmin` and CSRF protection.
- [ ] Implement dry-run script `backend/scripts/migrate-local-images-to-r2.js`.
- [ ] Update frontend file-picker component in `Admin.js` to support R2 upload workflow.
