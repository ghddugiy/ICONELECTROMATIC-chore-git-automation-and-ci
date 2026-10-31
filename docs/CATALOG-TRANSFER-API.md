# Catalog Transfer API & Execution Guide

This document describes the design, security controls, endpoints, and manual execution workflow for the initial catalog transfer into PostgreSQL for the Icon Electromatic website.

---

## 1. Architecture & Security Controls

### Zero Auto-Execution Guarantee
- The catalog transfer **never executes automatically** on application startup, page load, frontend build, or unit test runs.
- Execution requires an authenticated administrator session and explicit confirmation through the CMS Admin UI or authorized API call.

### Authentication & Authorization
- **Role Requirement**: Both `/dry-run` and `/execute` endpoints require an active session for an administrator user (`role: "ADMIN"`).
- **CSRF Protection**: All non-safe HTTP methods (POST) enforce double-submit CSRF validation via the `X-CSRF-Token` header and session-bound token hash.
- **Session Cookie**: Secure session cookies (`credentials: "include"`) are sent with every API request.

### Data Integrity & Conflict Safety
- **Atomic Transaction**: All database writes (15 OEMs, 88 Categories, 169 Products, 1 `ImportRun`, and 272 `ImportItem` audit records) are wrapped within a single Prisma interactive transaction (`prisma.$transaction`).
- **Automatic Rollback**: Any error during insertion triggers an immediate, full transaction rollback, leaving zero partial state in the database.
- **Repeat-Attempt Safety (Idempotency)**: If candidate records already exist with identical names and parent references, they are classified as `MATCH` and skipped without error.
- **Conflict Abort**: If an existing record has the same ID but conflicting parent or name attributes, execution aborts immediately with a `409 Conflict` error.
- **Link Sanitization**: Non-HTTP(S) link strings (such as TCR-EHF descriptive text) are preserved in `sourceData.link` while keeping `externalLink` set to `null` to comply with standard URL schemas.

---

## 2. API Endpoints

### 1. `POST /api/catalog/transfer/dry-run`
- **Description**: Read-only comparison between candidate catalog records and live PostgreSQL tables.
- **Database Writes**: **0 (Exclusively runs read queries `findMany`)**.
- **Request Headers**:
  - `Cookie: admin_session=...; admin_csrf=...`
  - `X-CSRF-Token: <token>`
- **Request Body (optional)**:
  ```json
  { "catalog": [...] }
  ```
  *(Defaults to baseline `CATALOG` if omitted)*
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "dryRun": true,
      "status": "PREVIEW_READY",
      "sourceFingerprint": "...",
      "counts": {
        "candidate": { "oems": 15, "categories": 88, "products": 169, "total": 272 },
        "existing": { "oems": 0, "categories": 0, "products": 0, "total": 0 },
        "proposedInserts": { "oems": 15, "categories": 88, "products": 169, "total": 272 },
        "matches": { "oems": 0, "categories": 0, "products": 0, "total": 0 },
        "conflicts": { "total": 0 },
        "skips": { "total": 0 }
      },
      "hierarchy": { "valid": true, "orphanedCategories": [], "orphanedProducts": [] },
      "duplicates": { "valid": true, "duplicateOemIds": [], "duplicateCategoryIds": [], "duplicateProductIds": [] },
      "urlSanitization": { "flaggedCount": 3, "items": [...] },
      "safetyNotice": "DRY-RUN ONLY: Zero database writes performed."
    }
  }
  ```

---

### 2. `POST /api/catalog/transfer/execute`
- **Description**: Executes the atomic transfer within a PostgreSQL transaction.
- **Prerequisites**: Valid ADMIN session + CSRF token.
- **Request Headers**:
  - `Cookie: admin_session=...; admin_csrf=...`
  - `X-CSRF-Token: <token>`
- **Request Body (optional)**:
  ```json
  { "catalog": [...] }
  ```
- **Response on Success**:
  ```json
  {
    "success": true,
    "data": {
      "importRunId": "cm...",
      "status": "APPLIED",
      "transferred": { "oems": 15, "categories": 88, "products": 169, "total": 272 },
      "skippedMatches": { "oems": 0, "categories": 0, "products": 0, "total": 0 },
      "completedAt": "2026-10-21T..."
    }
  }
  ```
- **Response on Repeat Attempt (Already Applied)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ALREADY_APPLIED",
      "message": "All candidate catalog records are already present in PostgreSQL. No records modified.",
      "transferred": { "oems": 0, "categories": 0, "products": 0, "total": 0 },
      "skippedMatches": { "oems": 15, "categories": 88, "products": 169, "total": 272 }
    }
  }
  ```

---

## 3. Frontend Workflow (`src/admin/Admin.js`)

1. **Toolbar Buttons**:
   - When the backend catalog is empty, two distinct actions are displayed:
     - `Preview transfer` (`#btn-preview-catalog-migration`): Opens read-only audit modal.
     - `Execute Transfer to PostgreSQL` (`#btn-execute-catalog-transfer`): Opens confirmation dialog.
2. **Confirmation Modal**:
   - Explains the transfer scope: 15 OEMs, 88 categories, and 169 products (272 total).
   - Requires explicit click on **Confirm & Execute Transfer**.
3. **Double-Click & Concurrency Lock**:
   - `isExecutingTransfer` flag prevents duplicate submissions.
   - Action buttons are disabled during processing with an animated spinner.
4. **Automated Pre-Execution Dry-Run**:
   - Immediately prior to sending the execute request, the frontend calls `POST /dry-run`.
   - If any conflicts, hierarchy errors, duplicate IDs, or unexpected counts (not 15/88/169) are detected, the transfer aborts immediately without calling `/execute`.
5. **Server-Side Post-Execution Verification**:
   - After `/execute` responds, `CatalogService.verifyBackendCatalog()` queries the live database via `/oems`, `/categories`, and `/products`.
   - Verifies that 15 OEMs, 88 categories, and 169 products exist.
   - If counts match, the modal closes, the admin UI transitions out of the paused banner, and a success toast is shown.
   - If counts mismatch, an error notice is displayed and success is never reported.

---

## 4. Manual Execution Instructions (For Owner / Administrator)

When ready to perform the initial catalog transfer:

1. **Start Backend & Frontend Servers**:
   ```powershell
   # Terminal 1: Backend
   cd backend
   npm run dev

   # Terminal 2: Frontend
   npm run dev
   ```
2. **Access Admin CMS**:
   - Open your browser to the local URL reported by Vite (typically `http://localhost:3000/#admin` as configured in `vite.config.js`, or `http://localhost:5173/#admin`), or click **Employee Zone** in the website header.
   - Log in with administrator credentials.
3. **Navigate to Catalog Management**:
   - Select the **Products / OEMs** tab.
   - You will see the yellow warning banner: *"Backend catalog is empty. Your existing browser catalog and images are preserved."*
4. **Inspect & Execute**:
   - Click **Preview transfer** to inspect the full read-only comparison.
   - Click **Execute Transfer to PostgreSQL** (or click *"Proceed to Execute Transfer..."* inside the preview).
   - Review the confirmation dialog detailing 15 OEMs, 88 categories, and 169 products.
   - Click **Confirm & Execute Transfer**.
5. **Verification**:
   - The UI will show progressive progress:
     1. Pre-execution dry-run validation...
     2. Executing atomic transfer...
     3. Verifying live database catalog counts...
   - Upon completion, the confirmation modal closes, a green toast confirms 272 records transferred, and the banner disappears, unlocking the full catalog editor.
