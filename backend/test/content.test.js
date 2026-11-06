/**
 * content.test.js
 *
 * Dedicated test suite for database-backed CMS site content:
 *   - pageKey validation (isValidPageKey)
 *   - Public retrieval (GET /api/content/:pageKey)
 *   - Uncustomized default handling ({ content: null, isDefault: true })
 *   - Admin access control (requireAdminMiddleware enforcement)
 *   - Admin retrieval with audit metadata (GET /api/admin/content/:pageKey)
 *   - Admin persistence and upsert (PUT /api/admin/content/:pageKey)
 *   - Admin listing of all sections (GET /api/admin/content)
 *   - Data integrity for rich JSON content (nested objects, arrays, stats)
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createContentRouter, createAdminContentRouter, isValidPageKey } from "../src/routes/content.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Prisma Client for isolated in-memory unit tests
// ─────────────────────────────────────────────────────────────────────────────

function createMockPrismaClient(initialRecords = []) {
  const store = new Map();

  for (const record of initialRecords) {
    store.set(record.pageKey, {
      id: record.id || `cuid_${record.pageKey}`,
      pageKey: record.pageKey,
      content: record.content,
      createdAt: record.createdAt || new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: record.updatedAt || new Date("2026-01-01T00:00:00.000Z"),
      updatedById: record.updatedById || "admin_user_1",
      updatedBy: record.updatedBy || { id: "admin_user_1", email: "admin@iconelectromatic.com" },
    });
  }

  return {
    _store: store,
    siteContent: {
      async findUnique({ where }) {
        return store.get(where.pageKey) || null;
      },
      async findMany({ orderBy } = {}) {
        const list = Array.from(store.values());
        if (orderBy?.pageKey === "asc") {
          list.sort((a, b) => a.pageKey.localeCompare(b.pageKey));
        }
        return list;
      },
      async upsert({ where, create, update }) {
        const existing = store.get(where.pageKey);
        const now = new Date();
        if (existing) {
          const updated = {
            ...existing,
            content: update.content,
            updatedById: update.updatedById || existing.updatedById,
            updatedAt: now,
          };
          store.set(where.pageKey, updated);
          return updated;
        } else {
          const created = {
            id: `cuid_${create.pageKey}`,
            pageKey: create.pageKey,
            content: create.content,
            createdAt: now,
            updatedAt: now,
            updatedById: create.updatedById || null,
          };
          store.set(create.pageKey, created);
          return created;
        }
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test HTTP Harness
// ─────────────────────────────────────────────────────────────────────────────

function createTestServer({
  prismaClient,
  isAuthenticated = false,
  adminUser = { id: "admin_test_123", email: "testadmin@iconelectromatic.com" },
} = {}) {
  const app = express();
  app.use(express.json());

  // Mock admin middleware
  const mockRequireAdmin = (req, res, next) => {
    if (!isAuthenticated) {
      return res.status(401).json({ success: false, message: "Unauthorized admin access." });
    }
    req.adminUser = adminUser;
    next();
  };

  const publicRouter = createContentRouter({ prismaClient });
  const adminRouter = createAdminContentRouter({
    prismaClient,
    requireAdminMiddleware: mockRequireAdmin,
  });

  app.use("/api/content", publicRouter);
  app.use("/api/admin/content", adminRouter);

  const server = http.createServer(app);
  return server;
}

function request(server, { method = "GET", path, body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const reqHeaders = { ...headers };
    let payload = null;

    if (body !== null) {
      payload = JSON.stringify(body);
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: addr.port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Unit Validation
// ─────────────────────────────────────────────────────────────────────────────

test("isValidPageKey validates allowed identifiers and blocks invalid inputs", () => {
  // Valid keys
  assert.equal(isValidPageKey("home"), true);
  assert.equal(isValidPageKey("about"), true);
  assert.equal(isValidPageKey("header"), true);
  assert.equal(isValidPageKey("footer"), true);
  assert.equal(isValidPageKey("about-us"), true);
  assert.equal(isValidPageKey("section_123"), true);
  assert.equal(isValidPageKey("a".repeat(64)), true);

  // Invalid keys
  assert.equal(isValidPageKey(""), false);
  assert.equal(isValidPageKey("   "), false);
  assert.equal(isValidPageKey(null), false);
  assert.equal(isValidPageKey(undefined), false);
  assert.equal(isValidPageKey(123), false);
  assert.equal(isValidPageKey("page key"), false); // spaces
  assert.equal(isValidPageKey("page/key"), false); // path separator
  assert.equal(isValidPageKey("../etc/passwd"), false); // path traversal
  assert.equal(isValidPageKey("<script>"), false); // html tags
  assert.equal(isValidPageKey("a".repeat(65)), false); // too long
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Public Endpoints
// ─────────────────────────────────────────────────────────────────────────────

test("GET /api/content/:pageKey returns 400 for invalid pageKey format", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, { path: "/api/content/invalid%20key!" });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid pagekey format/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/content/:pageKey returns 200 with content: null and isDefault: true when uncustomized", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, { path: "/api/content/home" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.pageKey, "home");
    assert.equal(res.body.content, null);
    assert.equal(res.body.isDefault, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("GET /api/content/:pageKey returns 200 with stored content when customized in PostgreSQL", async () => {
  const homeContent = {
    heroTitle: "Custom Mission-Ready Hardware Title",
    stats: [
      { id: "stat-1", value: "5,000+", label: "TESTED COMPONENTS" },
    ],
  };

  const prismaMock = createMockPrismaClient([
    { pageKey: "home", content: homeContent },
  ]);
  const server = createTestServer({ prismaClient: prismaMock });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, { path: "/api/content/home" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.pageKey, "home");
    assert.deepEqual(res.body.content, homeContent);
    assert.equal(res.body.isDefault, false);
    assert.ok(res.body.updatedAt);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: Admin Authorization & Endpoints
// ─────────────────────────────────────────────────────────────────────────────

test("Admin endpoints reject unauthenticated requests with HTTP 401", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: false });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    // 1. List
    const listRes = await request(server, { path: "/api/admin/content" });
    assert.equal(listRes.status, 401);

    // 2. Read
    const getRes = await request(server, { path: "/api/admin/content/header" });
    assert.equal(getRes.status, 401);

    // 3. Write
    const putRes = await request(server, {
      method: "PUT",
      path: "/api/admin/content/header",
      body: { content: { ctaLabel: "Contact Now" } },
    });
    assert.equal(putRes.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin PUT /api/admin/content/:pageKey validates content payload", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    // Missing body or null content
    const res1 = await request(server, {
      method: "PUT",
      path: "/api/admin/content/header",
      body: {},
    });
    assert.equal(res1.status, 400);
    assert.match(res1.body.message, /valid 'content' object or array/i);

    // Non-object content (string)
    const res2 = await request(server, {
      method: "PUT",
      path: "/api/admin/content/header",
      body: { content: "plain string not allowed" },
    });
    assert.equal(res2.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin PUT /api/admin/content/:pageKey creates and updates content in database", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({
    prismaClient: prismaMock,
    isAuthenticated: true,
    adminUser: { id: "admin_master_1", email: "admin@iconelectromatic.com" },
  });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const headerData = {
      navHome: "Home",
      navAbout: "About Us",
      ctaLabel: "Get a Quote",
      ctaLink: "/contact",
    };

    // 1. Create content via PUT
    const putRes1 = await request(server, {
      method: "PUT",
      path: "/api/admin/content/header",
      body: { content: headerData },
    });
    assert.equal(putRes1.status, 200);
    assert.equal(putRes1.body.success, true);
    assert.equal(putRes1.body.pageKey, "header");
    assert.deepEqual(putRes1.body.content, headerData);

    // Verify stored in mock Prisma database with updatedById
    const stored = await prismaMock.siteContent.findUnique({ where: { pageKey: "header" } });
    assert.ok(stored);
    assert.deepEqual(stored.content, headerData);
    assert.equal(stored.updatedById, "admin_master_1");

    // 2. Update content via PUT
    const updatedHeaderData = {
      ...headerData,
      ctaLabel: "Request Custom RF Solution",
    };

    const putRes2 = await request(server, {
      method: "PUT",
      path: "/api/admin/content/header",
      body: { content: updatedHeaderData },
    });
    assert.equal(putRes2.status, 200);
    assert.equal(putRes2.body.content.ctaLabel, "Request Custom RF Solution");

    // 3. Verify public GET sees the new persisted content immediately
    const publicRes = await request(server, { path: "/api/content/header" });
    assert.equal(publicRes.status, 200);
    assert.equal(publicRes.body.content.ctaLabel, "Request Custom RF Solution");
    assert.equal(publicRes.body.isDefault, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin GET /api/admin/content/:pageKey returns audit information", async () => {
  const prismaMock = createMockPrismaClient([
    {
      pageKey: "footer",
      content: { tagline: "Premier RF distributor." },
      updatedBy: { id: "admin_user_99", email: "editor@iconelectromatic.com" },
    },
  ]);
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, { path: "/api/admin/content/footer" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.pageKey, "footer");
    assert.equal(res.body.updatedBy.email, "editor@iconelectromatic.com");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin GET /api/admin/content lists all saved sections", async () => {
  const prismaMock = createMockPrismaClient([
    { pageKey: "home", content: { title: "Home" } },
    { pageKey: "header", content: { title: "Header" } },
    { pageKey: "footer", content: { title: "Footer" } },
  ]);
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, { path: "/api/admin/content" });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.count, 3);
    assert.equal(res.body.items.length, 3);
    // Verified ordered by pageKey asc
    assert.equal(res.body.items[0].pageKey, "footer");
    assert.equal(res.body.items[1].pageKey, "header");
    assert.equal(res.body.items[2].pageKey, "home");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin PUT preserves complex nested JSON structures (arrays, objects, booleans, stats)", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  const complexAboutData = {
    heroTitle: "Engineering Advanced High-Frequency Solutions",
    milestones: [
      { year: "2010", title: "Incorporation", description: "Established in Bengaluru." },
      { year: "2018", title: "Mil-Spec Expansion", description: "Supplied space-grade screening." },
    ],
    settings: {
      showTimeline: true,
      maxItems: 10,
      tags: ["RF", "Microwave", "Defense"],
    },
  };

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const res = await request(server, {
      method: "PUT",
      path: "/api/admin/content/about",
      body: { content: complexAboutData },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.content, complexAboutData);

    const publicRes = await request(server, { path: "/api/content/about" });
    assert.equal(publicRes.status, 200);
    assert.deepEqual(publicRes.body.content, complexAboutData);
    assert.equal(publicRes.body.content.milestones.length, 2);
    assert.equal(publicRes.body.content.settings.showTimeline, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin PUT performs idempotent upserts without creating duplicate rows for the same pageKey", async () => {
  const prismaMock = createMockPrismaClient();
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    for (let i = 1; i <= 5; i++) {
      const res = await request(server, {
        method: "PUT",
        path: "/api/admin/content/services",
        body: { content: { version: i, title: `Services v${i}` } },
      });
      assert.equal(res.status, 200);
    }

    assert.equal(prismaMock._store.size, 1);
    const finalStored = prismaMock._store.get("services");
    assert.equal(finalStored.content.version, 5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Public GET /api/content/:pageKey sets Cache-Control and ETag headers, and supports HTTP 304", async () => {
  const homeData = { heroTitle: "Icon Electromatic" };
  const prismaMock = createMockPrismaClient([
    { pageKey: "home", content: homeData, updatedAt: new Date("2026-05-01T12:00:00.000Z") },
  ]);
  const server = createTestServer({ prismaClient: prismaMock });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    // 1. Initial GET
    const res1 = await request(server, { path: "/api/content/home" });
    assert.equal(res1.status, 200);
    assert.equal(
      res1.headers["cache-control"],
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
    );
    const etag = res1.headers["etag"];
    assert.ok(etag, "ETag header must be present");
    assert.match(etag, /^W\/"home-\d+"/);

    // 2. Revalidation with matching If-None-Match
    const res2 = await request(server, {
      path: "/api/content/home",
      headers: { "if-none-match": etag },
    });
    assert.equal(res2.status, 304);
    assert.equal(res2.headers["etag"], etag);

    // 3. Revalidation with mismatched If-None-Match
    const res3 = await request(server, {
      path: "/api/content/home",
      headers: { "if-none-match": 'W/"different-etag"' },
    });
    assert.equal(res3.status, 200);
    assert.deepEqual(res3.body.content, homeData);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin endpoints set Cache-Control: no-store and Pragma: no-cache", async () => {
  const prismaMock = createMockPrismaClient([
    { pageKey: "header", content: { cta: "Quote" } },
  ]);
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const listRes = await request(server, { path: "/api/admin/content" });
    assert.equal(listRes.status, 200);
    assert.match(listRes.headers["cache-control"], /no-store/);
    assert.equal(listRes.headers["pragma"], "no-cache");

    const getRes = await request(server, { path: "/api/admin/content/header" });
    assert.equal(getRes.status, 200);
    assert.match(getRes.headers["cache-control"], /no-store/);
    assert.equal(getRes.headers["pragma"], "no-cache");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Admin PUT rejects conflicting concurrent updates with HTTP 409", async () => {
  const baseDate = new Date("2026-05-01T10:00:00.000Z");
  const newerDate = new Date("2026-05-01T11:00:00.000Z");

  const prismaMock = createMockPrismaClient([
    {
      pageKey: "about",
      content: { version: 1, title: "Original About" },
      updatedAt: newerDate, // Database has newer version
    },
  ]);
  const server = createTestServer({ prismaClient: prismaMock, isAuthenticated: true });

  await new Promise((resolve) => server.listen(0, resolve));
  try {
    // Attempt save with stale expectedUpdatedAt (older than database version)
    const conflictRes = await request(server, {
      method: "PUT",
      path: "/api/admin/content/about",
      body: {
        content: { version: 2, title: "Stale Overwrite Attempt" },
        expectedUpdatedAt: baseDate.toISOString(), // 10:00, but DB has 11:00
      },
    });

    assert.equal(conflictRes.status, 409);
    assert.equal(conflictRes.body.success, false);
    assert.equal(conflictRes.body.code, "CONCURRENT_MODIFICATION");
    assert.match(conflictRes.body.message, /modified by another administrator/i);

    // Database content was preserved
    const stored = prismaMock._store.get("about");
    assert.equal(stored.content.version, 1);

    // Attempt save with up-to-date expectedUpdatedAt succeeds
    const successRes = await request(server, {
      method: "PUT",
      path: "/api/admin/content/about",
      body: {
        content: { version: 3, title: "Resolved Up-to-Date Save" },
        expectedUpdatedAt: newerDate.toISOString(),
      },
    });

    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.success, true);
    assert.equal(successRes.body.content.version, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
