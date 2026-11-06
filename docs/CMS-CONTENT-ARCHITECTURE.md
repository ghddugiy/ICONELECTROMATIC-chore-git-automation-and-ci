# Database-Backed CMS Content Architecture

## 1. Executive Summary & Objective

Prior to this implementation (identified as Finding H1 during the Production Readiness Security Audit), non-catalog website content—such as homepage hero text, statistics, about page milestones, services pillars, contact details, testimonials, blogs, header, and footer settings—was stored exclusively inside browser `localStorage` (`cms_${pageKey}`). As a result, content updates made by an administrator were visible only on the specific browser and device where the edits occurred, and were never delivered to public website visitors.

This implementation migrates all non-catalog CMS content into the centralized PostgreSQL database through the Node.js/Express backend, ensuring that:
1. Administrator edits are validated and persisted to PostgreSQL.
2. All public visitors on any device or browser receive the latest published content.
3. Edits persist across browser restarts, cache clears, and server deployments.
4. If the backend or database is unreachable, the frontend gracefully falls back to compiled static defaults without crashing.
5. Existing browser drafts can be migrated to the database without data loss.

---

## 2. Database Schema & Migration

### 2.1 Prisma Model: `SiteContent`
The data model is defined in `backend/prisma/schema.prisma`:

```prisma
model SiteContent {
  id          String     @id @default(cuid())
  pageKey     String     @unique
  content     Json
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  updatedById String?
  updatedBy   AdminUser? @relation(fields: [updatedById], references: [id], onDelete: SetNull)

  @@index([pageKey])
}
```

### 2.2 Relationships and Constraints
- **`pageKey` (Unique Index)**: Identifies the content section (e.g., `home`, `about`, `header`, `footer`). Enforces a 1:1 mapping per key and prevents duplicate rows.
- **`content` (JSONB)**: Stores arbitrary structured content (nested objects, arrays, stats, milestone lists, settings) without requiring schema alterations for new marketing blocks.
- **`updatedById` (Foreign Key)**: Optional relation to `AdminUser(id)` with `onDelete: SetNull` to record audit history.
- **`updatedAt`**: Automatically updated on every save.

### 2.3 Migration
The schema is managed via Prisma migration:
- **Migration File**: `backend/prisma/migrations/20261105000000_add_site_content_model/migration.sql`
- **Application**: Executed idempotently using `prisma migrate deploy` or `prisma db push`.

---

## 3. Backend API Specification

All endpoints are hosted on the Express application mounted in `backend/src/server.js`.

### 3.1 Public Read Endpoint
- **URL**: `GET /api/content/:pageKey`
- **Authentication**: None (publicly accessible).
- **Validation**: `pageKey` must match `/^[a-zA-Z0-9_-]{1,64}$/`. Invalid keys return HTTP 400.
- **Caching & Conditional Requests**:
  - `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`
  - `ETag: W/"<pageKey>-<updatedAt>"`
  - Supports `If-None-Match`: Returns HTTP 304 Not Modified when ETag matches.
- **Responses**:
  - **Stored Content Found (HTTP 200)**:
    ```json
    {
      "success": true,
      "pageKey": "home",
      "content": { ... },
      "updatedAt": "2026-11-05T01:23:45.678Z",
      "isDefault": false
    }
    ```
  - **No Record Found / Uncustomized (HTTP 200)**:
    ```json
    {
      "success": true,
      "pageKey": "home",
      "content": null,
      "isDefault": true
    }
    ```
  *(Note: Editor audit metadata such as `updatedBy` is omitted from public responses to prevent user data leakage).*

### 3.2 Admin Retrieval Endpoint
- **URL**: `GET /api/admin/content/:pageKey`
- **Authentication**: Gated by `requireAdmin` middleware. Unauthorized requests return HTTP 401.
- **Caching**: `Cache-Control: no-store, no-cache, must-revalidate, private` and `Pragma: no-cache`.
- **Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "pageKey": "home",
    "content": { ... },
    "updatedAt": "2026-11-05T01:23:45.678Z",
    "updatedBy": {
      "id": "cuid...",
      "email": "admin@iconelectromatic.com"
    },
    "isDefault": false
  }
  ```

### 3.3 Admin List Endpoint
- **URL**: `GET /api/admin/content`
- **Authentication**: Gated by `requireAdmin` middleware.
- **Caching**: `Cache-Control: no-store, no-cache, must-revalidate, private`.
- **Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "count": 3,
    "items": [
      {
        "id": "cuid1",
        "pageKey": "footer",
        "updatedAt": "2026-11-05T01:00:00.000Z",
        "updatedBy": { "email": "admin@iconelectromatic.com" }
      },
      {
        "id": "cuid2",
        "pageKey": "header",
        "updatedAt": "2026-11-05T01:10:00.000Z",
        "updatedBy": { "email": "admin@iconelectromatic.com" }
      }
    ]
  }
  ```

### 3.4 Admin Upsert / Save Endpoint
- **URL**: `PUT /api/admin/content/:pageKey`
- **Authentication**: Gated by `requireAdmin` + double-submit CSRF token validation (`X-CSRF-Token`).
- **Body Requirement**: JSON object with `{ "content": { ... }, "expectedUpdatedAt": "2026-..." }` (content must be non-null object or array).
- **Optimistic Concurrency Control**:
  - Accepts optional `expectedUpdatedAt` string.
  - If a database record exists and its `updatedAt` is strictly newer than `expectedUpdatedAt`, returns **HTTP 409 Conflict** with `{ error: "This content was modified by another user...", code: "CONCURRENT_MODIFICATION", currentUpdatedAt, currentContent }`.
- **Behavior**: Performs an atomic `prisma.siteContent.upsert` keyed by `pageKey`. Sets `updatedById` from `req.adminUser.id`.
- **Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "message": "Content for 'home' saved successfully.",
    "pageKey": "home",
    "content": { ... },
    "updatedAt": "2026-11-05T01:23:45.678Z"
  }
  ```

---

## 4. Supported Content Modules

The system manages 12 non-catalog CMS content types:

| Section Key | Content Managed |
|---|---|
| `home` | Hero headline, subtitle, background video/image, stats, core capabilities, section leads |
| `about` | Mission, vision, core values, domain badges, historical timeline milestones |
| `services` | 4 engineering service pillars, photo carousels, technical capabilities tags |
| `contact` | Global office addresses (India, Singapore, USA), emails, phone numbers, career application presets |
| `header` | Logo URLs (dark/light), navigation menu labels, primary quote CTA destination |
| `footer` | Tagline, copyright statement, office contacts, social media URLs |
| `partners` | Authorized OEM partners ticker, partner badges, domain descriptions |
| `blogs` | OEM news bulletins, application whitepapers, video demonstrations, official links |
| `projects` | Featured defense & aerospace engineering mission highlights |
| `gallery` | High-Rel hardware and component photography |
| `testimonials` | Client reviews, ratings, scientist and defense engineer credentials |
| `seo` | Global default meta titles, descriptions, keywords, OpenGraph fallback tags |

---

## 5. Frontend Integration & Synchronization

The frontend integration is implemented in `src/data/ContentService.js` and wired into `src/main.js` and `src/admin/Admin.js`.

### 5.1 Caching and Preloading Strategy
- **Layer 1: In-Memory Cache with 60s TTL (`_memoryCache`)**: Fast synchronous access for UI rendering. Tracks fetch timestamps; if cached data is older than 60,000 ms, `getData()` serves the cached data and triggers background revalidation.
- **Layer 2: Browser Storage (`localStorage.getItem('cms_${key}')`)**: Secondary fast-hydration layer for offline or cold-start scenarios.
- **Layer 3: Compiled Defaults (`INITIAL_CONTENT`)**: Authentic static data compiled into the application bundle.
- **Proactive Startup Preload**: In `src/main.js`, all 12 supported CMS keys (`['home', 'about', 'services', 'contact', 'header', 'footer', 'partners', 'blogs', 'projects', 'gallery', 'testimonials', 'seo']`) are preloaded concurrently using non-blocking `Promise.allSettled()`.

### 5.2 Reactive Event Architecture
When updated content arrives from the database or after an administrator saves edits:
1. `ContentService` updates `_memoryCache` and `localStorage`.
2. Dispatches a window-level `cms-data-updated` event:
   ```js
   window.dispatchEvent(new CustomEvent('cms-data-updated', { detail: { pageKey, data } }));
   ```
3. Persistent layout elements (such as `site-header` and `.site-footer`) and public views automatically re-render without requiring a full page refresh.
4. Active administrative editing sessions on `/admin` ignore `cms-data-updated` events to avoid interrupting in-progress input form workflows.

### 5.3 Offline and Network Resilience
If the backend is down or unreachable:
1. `ContentService.fetchContent(pageKey)` logs a warning and falls back gracefully to `localStorage` or `INITIAL_CONTENT`.
2. The user experience remains uninterrupted and all pages render cleanly.

---

## 6. Legacy Browser Draft Migration

To safely handle legacy drafts or customizations previously configured in the administrator's browser before database integration was implemented:
1. **Inspection**: `ContentService.getLocalStorageDrafts()` detects keys in `localStorage` that differ from compiled defaults. It compares content against live database records (`/api/content/:key`) and identifies whether the database is already customized (`dbStatus: 'customized' | 'uncustomized'`).
2. **Hash Sync Tracking**: Tracks `cms_${key}_synced_hash` using a SHA-256 hash of the normalized JSON string to avoid duplicate migration prompts.
3. **Draft Review Modal**: When clicking **Sync Browser Drafts to Database**, a detailed review modal appears (`#a-draft-review-modal`):
   - Displays each modified section key and formatted payload size.
   - Flags potential collisions where the database is already customized.
   - Automatically unchecks conflicting sections to prevent accidental overwrites.
   - Requires explicit checkbox acknowledgment before allowing an overwrite of a customized database section.
4. **Selective Sync**: The administrator chooses which keys to migrate; unselected keys are left untouched.
5. **Draft Preservation**: `migrateLocalStorageDrafts(keysToMigrate)` saves selected drafts to PostgreSQL and marks them as synced without deleting `localStorage` items.

---

## 7. Verification and Testing

### 7.1 Backend Unit & Integration Tests
The dedicated test suite `backend/test/content.test.js` (14 passing tests) covers:
- `isValidPageKey` unit validation (validates identifiers, rejects path traversal and XSS injections).
- Public `GET /api/content/:pageKey` (400 on invalid key, 200 with `{ content: null, isDefault: true }` when uncustomized, 200 with content when saved).
- Admin authentication enforcement (HTTP 401 on unauthenticated list, read, and write).
- Admin `PUT /api/admin/content/:pageKey` payload validation and idempotent upsert persistence.
- Admin `GET /api/admin/content/:pageKey` audit metadata verification (`updatedBy`).
- Admin `GET /api/admin/content` listing of all saved sections.
- Preservation of nested JSON data structures and array payloads.
- Public `GET /api/content/:pageKey` caching: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, ETag, and HTTP 304 Not Modified revalidation.
- Admin endpoints caching: `Cache-Control: no-store, no-cache, must-revalidate, private` and `Pragma: no-cache`.
- Optimistic concurrency control: HTTP 409 Conflict rejection when `expectedUpdatedAt` does not match the database timestamp.

### 7.2 Production Build Verification
- `npm run build` runs `vite build && node scripts/prerender.js`.
- Prerenders all 169 product pages and generates 176 valid canonical sitemap URLs with zero errors.
