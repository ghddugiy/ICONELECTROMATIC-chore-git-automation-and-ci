import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { CATALOG } from "../../src/data/catalogData.js";
import {
  normalizeCatalog,
  validateHierarchy,
  computeFingerprint,
  analyzeTransfer,
  createTransferRouter,
} from "../src/routes/transfer.js";
import prisma from "../src/db.js";
import { createRequireAdmin } from "../src/middleware/requireAdmin.js";
import { createOpaqueToken, hashOpaqueToken } from "../src/auth/security.js";

// Helper mock to simulate Prisma database calls in unit tests
function createMockPrisma({
  existingOems = [],
  existingCategories = [],
  existingProducts = [],
  transactionError = null,
} = {}) {
  const state = {
    oems: [...existingOems],
    categories: [...existingCategories],
    products: [...existingProducts],
    importRuns: [],
    importItems: [],
    writesAttempted: 0,
  };

  const mock = {
    state,
    oem: {
      findMany: async () => state.oems,
      create: async ({ data }) => {
        state.writesAttempted++;
        state.oems.push(data);
        return data;
      },
    },
    category: {
      findMany: async () => state.categories,
      create: async ({ data }) => {
        state.writesAttempted++;
        state.categories.push(data);
        return data;
      },
    },
    product: {
      findMany: async () => state.products,
      create: async ({ data }) => {
        state.writesAttempted++;
        state.products.push(data);
        return data;
      },
    },
    importRun: {
      create: async ({ data }) => {
        state.writesAttempted++;
        const record = { id: `run-${Date.now()}`, ...data };
        state.importRuns.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        state.writesAttempted++;
        const item = state.importRuns.find((r) => r.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      },
    },
    importItem: {
      create: async ({ data }) => {
        state.writesAttempted++;
        const record = { id: `item-${Date.now()}`, ...data };
        state.importItems.push(record);
        return record;
      },
    },
    $transaction: async (callback) => {
      if (transactionError) {
        throw transactionError;
      }
      return callback(mock);
    },
  };

  return mock;
}

test("normalizeCatalog flattens 15 OEMs, 88 categories, and 169 products with zero duplicates", () => {
  const normalized = normalizeCatalog(CATALOG);

  assert.equal(normalized.oems.length, 15);
  assert.equal(normalized.categories.length, 88);
  assert.equal(normalized.products.length, 169);
  assert.equal(normalized.duplicates.valid, true);
  assert.equal(normalized.duplicates.duplicateOemIds.length, 0);
  assert.equal(normalized.duplicates.duplicateCategoryIds.length, 0);
  assert.equal(normalized.duplicates.duplicateProductIds.length, 0);
});

test("normalizeCatalog sanitizes non-URL link strings preserving them in sourceData.link", () => {
  const normalized = normalizeCatalog(CATALOG);

  assert.equal(normalized.urlSanitization.flaggedCount, 3);
  const flaggedIds = normalized.urlSanitization.items.map((i) => i.id);
  assert.ok(flaggedIds.includes("tcr-ehf-25n18p8x-55"));
  assert.ok(flaggedIds.includes("tcr-ehf-50n18p8x-56"));
  assert.ok(flaggedIds.includes("tcr-ehf-100n18p8x-57"));

  // Verify the product itself has externalLink = null and sourceData.link populated
  const product55 = normalized.products.find((p) => p.id === "tcr-ehf-25n18p8x-55");
  assert.ok(product55);
  assert.equal(product55.externalLink, null);
  assert.match(product55.sourceData.link, /TCR-EHF/);
});

test("validateHierarchy confirms all categories have valid OEMs and all products have valid Categories", () => {
  const normalized = normalizeCatalog(CATALOG);
  const hierarchy = validateHierarchy(normalized.oems, normalized.categories, normalized.products);

  assert.equal(hierarchy.valid, true);
  assert.equal(hierarchy.orphanedCategories.length, 0);
  assert.equal(hierarchy.orphanedProducts.length, 0);
});

test("validateHierarchy detects orphaned categories and products when relationships are broken", () => {
  const brokenCategories = [{ id: "bad-cat", oemId: "non-existent-oem", name: "Bad Cat" }];
  const brokenProducts = [{ id: "bad-prod", categoryId: "non-existent-cat", name: "Bad Prod" }];

  const hierarchy = validateHierarchy([], brokenCategories, brokenProducts);

  assert.equal(hierarchy.valid, false);
  assert.equal(hierarchy.orphanedCategories.length, 1);
  assert.equal(hierarchy.orphanedCategories[0].id, "bad-cat");
  assert.equal(hierarchy.orphanedProducts.length, 1);
  assert.equal(hierarchy.orphanedProducts[0].id, "bad-prod");
});

test("normalizeCatalog detects duplicate IDs across OEMs, Categories, and Products", () => {
  const candidateWithDupes = [
    {
      id: "oem-1",
      name: "OEM One",
      categories: [
        {
          id: "cat-1",
          name: "Cat One",
          products: [
            { id: "prod-1", name: "Prod One" },
            { id: "prod-1", name: "Prod One Duplicate" },
          ],
        },
      ],
    },
    {
      id: "oem-1",
      name: "OEM One Duplicate",
      categories: [],
    },
  ];

  const normalized = normalizeCatalog(candidateWithDupes);

  assert.equal(normalized.duplicates.valid, false);
  assert.deepEqual(normalized.duplicates.duplicateOemIds, ["oem-1"]);
  assert.deepEqual(normalized.duplicates.duplicateProductIds, ["prod-1"]);
});

test("computeFingerprint generates reproducible SHA-256 hash", () => {
  const normalized1 = normalizeCatalog(CATALOG);
  const normalized2 = normalizeCatalog(CATALOG);

  const hash1 = computeFingerprint(normalized1);
  const hash2 = computeFingerprint(normalized2);

  assert.match(hash1, /^[a-f0-9]{64}$/);
  assert.equal(hash1, hash2);
});

test("analyzeTransfer calculates inserts, matches, and conflicts accurately", async () => {
  const mockPrisma = createMockPrisma({
    existingOems: [{ id: "rogers-corporation", name: "Rogers Corporation", sortOrder: 0, visible: true }],
    existingCategories: [{ id: "rt-duroid", oemId: "rogers-corporation", name: "Different Name", sortOrder: 0, visible: true }],
  });

  const normalized = normalizeCatalog(CATALOG);
  const analysis = await analyzeTransfer(mockPrisma, normalized);

  // Rogers OEM matches
  assert.equal(analysis.matches.oems.length, 1);
  assert.equal(analysis.matches.oems[0].id, "rogers-corporation");

  // Other 14 OEMs proposed for insert
  assert.equal(analysis.inserts.oems.length, 14);

  // RT/Duroid has different name -> conflict
  assert.equal(analysis.conflicts.length, 1);
  assert.equal(analysis.conflicts[0].id, "rt-duroid");
  assert.equal(analysis.conflicts[0].reason, "Conflicting name or OEM parent for existing Category ID");
});

test("dry-run route performs zero database writes and returns complete comparison report", async () => {
  const mockPrisma = createMockPrisma();
  const mockRequireAdmin = (_req, _res, next) => next();

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const res = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/dry-run",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.data.dryRun, true);
  assert.equal(res.data.data.counts.proposedInserts.total, 272);
  assert.equal(res.data.data.counts.proposedInserts.oems, 15);
  assert.equal(res.data.data.counts.proposedInserts.categories, 88);
  assert.equal(res.data.data.counts.proposedInserts.products, 169);
  assert.equal(res.data.data.urlSanitization.flaggedCount, 3);
  assert.equal(res.data.data.conflicts.length, 0);

  // STRICT ZERO-WRITE ASSERTION:
  assert.equal(mockPrisma.state.writesAttempted, 0);
  assert.equal(mockPrisma.state.oems.length, 0);
  assert.equal(mockPrisma.state.categories.length, 0);
  assert.equal(mockPrisma.state.products.length, 0);
  assert.equal(mockPrisma.state.importRuns.length, 0);
});

test("execute route in transaction inserts records and records ImportRun with mock Prisma", async () => {
  const mockPrisma = createMockPrisma();
  const mockRequireAdmin = (req, _res, next) => {
    req.adminUser = { id: "admin-123" };
    next();
  };

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.success, true);
  assert.equal(result.data.data.status, "APPLIED");
  assert.equal(result.data.data.transferred.total, 272);
  assert.equal(mockPrisma.state.oems.length, 15);
  assert.equal(mockPrisma.state.categories.length, 88);
  assert.equal(mockPrisma.state.products.length, 169);
  assert.equal(mockPrisma.state.importRuns.length, 1);
  assert.equal(mockPrisma.state.importRuns[0].status, "APPLIED");
});

test("execute route is repeat-attempt safe (skips existing matching records without error)", async () => {
  const normalized = normalizeCatalog(CATALOG);
  // Pre-populate mock Prisma with all records
  const mockPrisma = createMockPrisma({
    existingOems: normalized.oems,
    existingCategories: normalized.categories,
    existingProducts: normalized.products,
  });

  const mockRequireAdmin = (req, _res, next) => {
    req.adminUser = { id: "admin-123" };
    next();
  };

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.success, true);
  assert.equal(result.data.data.status, "ALREADY_APPLIED");
  assert.equal(result.data.data.transferred.total, 0);
  assert.equal(result.data.data.skippedMatches.total, 272);
});

test("execute route rolls back transaction on error without saving partial state", async () => {
  const transactionError = new Error("Simulated database failure during transaction");
  const mockPrisma = createMockPrisma({ transactionError });

  const mockRequireAdmin = (req, _res, next) => {
    req.adminUser = { id: "admin-123" };
    next();
  };

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: 500, error: err });
    });
  });

  assert.equal(result.statusCode, 500);
  assert.match(result.error.message, /Simulated database failure/);
  // Zero records committed
  assert.equal(mockPrisma.state.oems.length, 0);
  assert.equal(mockPrisma.state.categories.length, 0);
  assert.equal(mockPrisma.state.products.length, 0);
});

test("execute route rejects unauthenticated requests (missing admin session)", async () => {
  const mockPrisma = createMockPrisma();
  const realRequireAdmin = createRequireAdmin({
    prismaClient: {
      adminSession: {
        findUnique: async () => null,
      },
    },
    isProduction: false,
  });

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: realRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 401);
  assert.equal(result.data.success, false);
  assert.match(result.data.message, /Authentication required/);
  assert.equal(mockPrisma.state.writesAttempted, 0);
});

test("execute route rejects requests when CSRF token is missing or mismatched", async () => {
  const mockPrisma = createMockPrisma();
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const sessionTokenHash = hashOpaqueToken(sessionToken);
  const csrfTokenHash = hashOpaqueToken(csrfToken);

  const realRequireAdmin = createRequireAdmin({
    prismaClient: {
      adminSession: {
        findUnique: async () => ({
          id: "session-1",
          tokenHash: sessionTokenHash,
          csrfTokenHash: csrfTokenHash,
          revokedAt: null,
          absoluteExpiresAt: new Date(Date.now() + 60000),
          adminUser: {
            id: "admin-1",
            email: "admin@iconelectromatic.com",
            role: "ADMIN",
            active: true,
          },
        }),
        updateMany: async () => ({ count: 1 }),
      },
    },
    isProduction: false,
  });

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: realRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: {
        "content-type": "application/json",
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
      },
      get: (header) => (header.toLowerCase() === "x-csrf-token" ? "wrong-csrf-token" : undefined),
      body: {},
    };

    let statusCode = 200;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 403);
  assert.equal(result.data.success, false);
  assert.match(result.data.message, /CSRF validation failed/);
  assert.equal(mockPrisma.state.writesAttempted, 0);
});

test("execute route rejects transfer when conflicts are detected with existing database records (409)", async () => {
  const mockPrisma = createMockPrisma({
    existingOems: [
      { id: "rogers-corporation", name: "Conflicting Rogers OEM Name", sortOrder: 0, visible: true },
    ],
  });

  const mockRequireAdmin = (req, _res, next) => {
    req.adminUser = { id: "admin-123" };
    next();
  };

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: {},
    };

    let statusCode = 200;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 409);
  assert.match(result.data.message, /Transfer conflict/);
  assert.equal(mockPrisma.state.importRuns.length, 0);
  assert.equal(mockPrisma.state.categories.length, 0);
  assert.equal(mockPrisma.state.products.length, 0);
});

test("execute route rejects candidate catalog with duplicate IDs (400)", async () => {
  const mockPrisma = createMockPrisma();
  const mockRequireAdmin = (req, _res, next) => {
    req.adminUser = { id: "admin-123" };
    next();
  };

  const router = createTransferRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: mockRequireAdmin,
  });

  const candidateCatalog = [
    { id: "dup-oem", name: "Duplicate OEM 1", categories: [] },
    { id: "dup-oem", name: "Duplicate OEM 2", categories: [] },
  ];

  const result = await new Promise((resolve) => {
    const req = {
      method: "POST",
      url: "/execute",
      headers: { "content-type": "application/json" },
      body: { catalog: candidateCatalog },
    };

    let statusCode = 200;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        resolve({ statusCode, data });
      },
    };

    router(req, mockRes, (err) => {
      resolve({ statusCode: err?.status || 500, error: err });
    });
  });

  assert.equal(result.statusCode, 400);
  assert.match(result.data.message, /duplicate IDs detected/);
  assert.equal(mockPrisma.state.writesAttempted, 0);
});


// ─────────────────────────────────────────────────────────────────────────────
// Admin.js response-shape contract tests
//
// ApiService.post() strips the { success, data } envelope and returns the
// inner data object directly. Admin.js executeTransferWorkflow() was fixed to
// read that unwrapped shape. These tests document and enforce the contract.
// ─────────────────────────────────────────────────────────────────────────────

test("dry-run inner data has dryRun:true – satisfies Admin.js executeTransferWorkflow guard", async () => {
  const mockPrisma = createMockPrisma();
  const mockRequireAdmin = (_req, _res, next) => next();

  const router = createTransferRouter({ prismaClient: mockPrisma, requireAdminMiddleware: mockRequireAdmin });

  const res = await new Promise((resolve) => {
    const req = { method: "POST", url: "/dry-run", headers: {}, body: {} };
    let statusCode = 200;
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(data) { resolve({ statusCode, data }); },
    };
    router(req, mockRes, (err) => resolve({ statusCode: err?.status || 500, error: err }));
  });

  // Outer envelope
  assert.equal(res.statusCode, 200);
  assert.equal(res.data.success, true);

  // Inner data (what ApiService.post() returns as the resolved value)
  const innerData = res.data.data;

  // Admin.js guard: if (!dryRunRes || !dryRunRes.dryRun) → throw
  assert.equal(innerData.dryRun, true, "dryRun must be true so Admin.js guard passes");

  // Admin.js reads report directly (report = dryRunRes, not dryRunRes.data)
  assert.ok(innerData.counts?.candidate, "counts.candidate must exist on the inner object");
  assert.equal(innerData.counts.candidate.oems, 15);
  assert.equal(innerData.counts.candidate.categories, 88);
  assert.equal(innerData.counts.candidate.products, 169);
  assert.ok(innerData.hierarchy, "hierarchy must exist on the inner object");
  assert.equal(innerData.hierarchy.valid, true);
  assert.ok(innerData.duplicates, "duplicates must exist on the inner object");
  assert.equal(innerData.duplicates.valid, true);
  assert.ok(Array.isArray(innerData.conflicts), "conflicts must be an array on the inner object");
  assert.equal(innerData.conflicts.length, 0);

  // The inner object must NOT have .success or .data fields
  // (those belong to the outer envelope which ApiService strips)
  assert.equal(
    "success" in innerData,
    false,
    "inner data must not contain .success — Admin.js no longer checks it"
  );
  assert.equal(
    "data" in innerData,
    false,
    "inner data must not contain .data — Admin.js assigns report = dryRunRes directly"
  );
});

test("dry-run: null or missing dryRun property represents invalid response – Admin.js guard would reject it", () => {
  // Simulate what Admin.js now checks:
  //   if (!dryRunRes || !dryRunRes.dryRun) throw …
  const shouldReject = (val) => !val || !val.dryRun;

  assert.equal(shouldReject(null), true, "null must be rejected");
  assert.equal(shouldReject(undefined), true, "undefined must be rejected");
  assert.equal(shouldReject({}), true, "empty object (no dryRun) must be rejected");
  assert.equal(shouldReject({ dryRun: false }), true, "dryRun:false must be rejected");
  assert.equal(shouldReject({ success: true, data: {} }), true, "raw outer envelope must be rejected (ApiService has already unwrapped)");

  // Valid: the actual inner report
  assert.equal(shouldReject({ dryRun: true }), false, "dryRun:true must pass the guard");
});

test("execute inner data has status 'APPLIED' – satisfies Admin.js executeTransferWorkflow guard", async () => {
  const mockPrisma = createMockPrisma();
  const mockRequireAdmin = (req, _res, next) => { req.adminUser = { id: "admin-test" }; next(); };

  const router = createTransferRouter({ prismaClient: mockPrisma, requireAdminMiddleware: mockRequireAdmin });

  const result = await new Promise((resolve) => {
    const req = { method: "POST", url: "/execute", headers: {}, body: {}, adminUser: { id: "admin-test" } };
    let statusCode = 200;
    const mockRes = {
      status(code) { statusCode = code; return this; },
      json(data) { resolve({ statusCode, data }); },
    };
    router(req, mockRes, (err) => resolve({ statusCode: err?.status || 500, error: err }));
  });

  // Outer envelope
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.success, true);

  // Inner data (what ApiService.post() returns)
  const innerData = result.data.data;

  // Admin.js guard: if (!execRes || !['APPLIED', 'ALREADY_APPLIED'].includes(execRes.status)) → throw
  assert.ok(
    ["APPLIED", "ALREADY_APPLIED"].includes(innerData.status),
    `status must be APPLIED or ALREADY_APPLIED, got: ${innerData.status}`
  );

  // The inner object must NOT have a .success field
  assert.equal(
    "success" in innerData,
    false,
    "inner execute data must not contain .success — Admin.js no longer checks it"
  );
});

test("execute: missing or bad status represents failed execution – Admin.js guard would reject it", () => {
  // Simulate what Admin.js now checks:
  //   if (!execRes || !['APPLIED','ALREADY_APPLIED'].includes(execRes.status)) throw …
  const shouldReject = (val) => !val || !["APPLIED", "ALREADY_APPLIED"].includes(val?.status);

  assert.equal(shouldReject(null), true, "null must be rejected");
  assert.equal(shouldReject(undefined), true, "undefined must be rejected");
  assert.equal(shouldReject({}), true, "empty object (no status) must be rejected");
  assert.equal(shouldReject({ status: "FAILED" }), true, "status:FAILED must be rejected");
  assert.equal(shouldReject({ status: "APPLYING" }), true, "status:APPLYING must be rejected");
  assert.equal(shouldReject({ success: true }), true, "outer envelope shape must be rejected");

  // Valid statuses
  assert.equal(shouldReject({ status: "APPLIED" }), false, "status:APPLIED must pass");
  assert.equal(shouldReject({ status: "ALREADY_APPLIED" }), false, "status:ALREADY_APPLIED must pass");
});

test("POST-TRANSFER DATABASE VERIFICATION: PostgreSQL catalog tables contain the expected baseline counts", async () => {
  // The baseline catalog transfer was applied via the Admin CMS (1 ImportRun, APPLIED status).
  // These counts verify the transfer committed correctly and completely.
  const [oemCount, catCount, prodCount, importRunCount, importItemCount] = await Promise.all([
    prisma.oem.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.importRun.count(),
    prisma.importItem.count(),
  ]);

  assert.ok(oemCount >= 15, `oem table must have at least 15 records, got ${oemCount}`);
  assert.ok(catCount >= 88, `category table must have at least 88 records, got ${catCount}`);
  assert.ok(prodCount >= 169, `product table must have at least 169 records, got ${prodCount}`);
  assert.ok(importRunCount >= 1, `importRun table must have at least 1 record, got ${importRunCount}`);
  assert.ok(importItemCount >= 272, `importItem table must have at least 272 records (15+88+169), got ${importItemCount}`);
});

