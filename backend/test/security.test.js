import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  createApp,
  getAllowedOrigins,
  configureTrustProxy,
} from "../src/server.js";
import {
  createAttemptLimiter,
  createLoginRateLimitMiddleware,
  normalizeEmail,
  resolveClientIp,
} from "../src/middleware/loginRateLimit.js";
import {
  appendAuthCookies,
  createOpaqueToken,
  createPasswordHash,
  getAuthCookieNames,
  hashOpaqueToken,
} from "../src/auth/security.js";
import { createAuthRouter } from "../src/routes/auth.js";
import { createMediaRouter } from "../src/routes/media.js";
import { createRequireAdmin } from "../src/middleware/requireAdmin.js";

// Helper to launch a test server on an ephemeral port
async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// ── 1. HELMET SECURITY HEADERS ──────────────────────────────────────────────────

test("Helmet sets security headers and removes X-Powered-By", async () => {
  const app = createApp({ isProduction: false });

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    // Essential security headers
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.match(res.headers.get("strict-transport-security") || "", /max-age=\d+/);
    assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");

    // X-Powered-By must be stripped
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});

test("Media endpoint serves images with cross-origin CORP and nosniff headers", async () => {
  const fakeImageData = Buffer.from("fake-jpeg-image-bytes");
  const mockMediaAsset = {
    id: "media-uuid-123",
    r2Key: "products/2026/10/component.jpg",
    mimeType: "image/jpeg",
    byteSize: fakeImageData.length,
    status: "ACTIVE",
  };

  const mockPrisma = {
    mediaAsset: {
      findUnique: async ({ where }) => {
        if (where.id === "media-uuid-123") return mockMediaAsset;
        return null;
      },
    },
  };

  const mockR2Service = {
    getObjectStream: async (key) => {
      assert.equal(key, mockMediaAsset.r2Key);
      const stream = Readable.from(fakeImageData);
      return { Body: stream };
    },
  };

  const mediaRouter = createMediaRouter({
    prismaClient: mockPrisma,
    r2Service: mockR2Service,
    requireAdminMiddleware: (_req, _res, next) => next(),
  });

  const app = createApp({
    prismaClient: mockPrisma,
    mediaRouter,
    isProduction: false,
  });

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/media/file/media-uuid-123`);
    assert.equal(res.status, 200);

    // Headers verification
    assert.equal(res.headers.get("cross-origin-resource-policy"), "cross-origin");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(res.headers.get("cache-control"), "public, max-age=86400, immutable");
    assert.equal(res.headers.get("x-powered-by"), null);

    const bodyBuffer = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(bodyBuffer, fakeImageData);
  });
});

// ── 2. LOGIN RATE LIMITING & LOCKOUT DEFENSE ────────────────────────────────────

test("Login rate limiter tracks failed attempts by IP and email independently", async () => {
  let currentTime = 10000;
  const ipLimiter = createAttemptLimiter({
    windowMs: 5000,
    maxAttempts: 3,
    now: () => currentTime,
  });
  const emailLimiter = createAttemptLimiter({
    windowMs: 5000,
    maxAttempts: 3,
    now: () => currentTime,
  });

  let mockClientIp = "192.168.1.10";
  const rateLimitMiddleware = createLoginRateLimitMiddleware({
    ipLimiter,
    emailLimiter,
    resolveIp: () => mockClientIp,
  });

  const authRouter = createAuthRouter({
    prismaClient: {
      adminUser: {
        findUnique: async () => null, // always fail credentials
      },
    },
    loginRateLimitMiddleware: rateLimitMiddleware,
    isProduction: false,
  });

  const app = createApp({ authRouter, isProduction: false });

  await withServer(app, async (baseUrl) => {
    const loginPayload = { email: "admin@example.com", password: "wrong-password" };

    // 3 failed attempts from IP 192.168.1.10
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginPayload),
      });
      assert.equal(res.status, 401);
    }

    // 4th attempt from the same IP is blocked (429)
    const blockedIpRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
    });
    assert.equal(blockedIpRes.status, 429);
    assert.ok(blockedIpRes.headers.get("retry-after"));
    const blockedIpJson = await blockedIpRes.json();
    assert.match(blockedIpJson.message, /too many login attempts from this ip/i);

    // Switch to a new IP (simulating distributed brute force against the same email)
    mockClientIp = "10.0.0.99";
    const blockedEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
    });
    // Even though the IP is new, the account/email is blocked!
    assert.equal(blockedEmailRes.status, 429);
    const blockedEmailJson = await blockedEmailRes.json();
    assert.match(blockedEmailJson.message, /too many failed login attempts for this account/i);

    // Advance time past the 5-second window
    currentTime += 6000;

    // Both IP and email buckets are now expired and allowed again
    const resAfterExpiry = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
    });
    assert.equal(resAfterExpiry.status, 401); // reaching authentication logic, not 429
  });
});

test("Successful login resets the IP failure counter", async () => {
  const ipLimiter = createAttemptLimiter({
    windowMs: 60000,
    maxAttempts: 3,
  });
  const emailLimiter = createAttemptLimiter({
    windowMs: 60000,
    maxAttempts: 3,
  });

  const rateLimitMiddleware = createLoginRateLimitMiddleware({
    ipLimiter,
    emailLimiter,
    resolveIp: () => "1.2.3.4",
  });

  const correctPassword = "correct-horse-battery-staple";
  const validHash = await createPasswordHash(correctPassword);

  const adminRecord = {
    id: "admin-1",
    email: "admin@iconelectromatic.com",
    passwordHash: validHash,
    role: "ADMIN",
    active: true,
  };

  let sessionCount = 0;
  const mockPrisma = {
    adminUser: {
      findUnique: async ({ where }) =>
        where.email === adminRecord.email ? adminRecord : null,
    },
    adminSession: {
      create: async () => {
        sessionCount++;
        return { id: `session-${sessionCount}` };
      },
    },
  };

  const authRouter = createAuthRouter({
    prismaClient: mockPrisma,
    loginRateLimitMiddleware: rateLimitMiddleware,
    isProduction: false,
  });

  const app = createApp({
    prismaClient: mockPrisma,
    authRouter,
    isProduction: false,
  });

  await withServer(app, async (baseUrl) => {
    // 2 failed attempts (threshold is 3)
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@iconelectromatic.com",
          password: "wrong",
        }),
      });
      assert.equal(res.status, 401);
    }

    assert.equal(ipLimiter.getCount("1.2.3.4"), 2);
    assert.equal(emailLimiter.getCount("admin@iconelectromatic.com"), 2);

    // Now log in with correct credentials
    const successRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@iconelectromatic.com",
        password: correctPassword,
      }),
    });
    assert.equal(successRes.status, 200);

    // IP and email failure counters are reset on success!
    assert.equal(ipLimiter.getCount("1.2.3.4"), 0);
    assert.equal(emailLimiter.getCount("admin@iconelectromatic.com"), 0);
  });
});

// ── 3. CORS AND PROD ORIGIN ENFORCEMENT ─────────────────────────────────────────

test("CORS rejects unauthorized origins with 403 JSON without internal errors", async () => {
  const app = createApp({
    frontendUrl: "https://iconelectromatic.com",
    isProduction: false,
  });

  await withServer(app, async (baseUrl) => {
    // Allowed origin
    const okRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://iconelectromatic.com" },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get("access-control-allow-origin"), "https://iconelectromatic.com");
    assert.equal(okRes.headers.get("access-control-allow-credentials"), "true");

    // Unauthorized attacker origin
    const badRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://malicious-site.example" },
    });
    assert.equal(badRes.status, 403);
    const badJson = await badRes.json();
    assert.equal(badJson.success, false);
    assert.match(badJson.message, /cors request forbidden/i);
    assert.equal(badRes.headers.get("access-control-allow-origin"), null);
  });
});

test("In production mode, localhost is blocked unless explicitly in FRONTEND_URL", () => {
  // 1. In production, only FRONTEND_URL is allowed
  const prodOrigins = getAllowedOrigins({
    frontendUrl: "https://iconelectromatic.com",
    isProduction: true,
  });
  assert.equal(prodOrigins.has("https://iconelectromatic.com"), true);
  assert.equal(prodOrigins.has("http://localhost:5173"), false);
  assert.equal(prodOrigins.has("http://localhost:3000"), false);
  assert.equal(prodOrigins.has("http://127.0.0.1:5173"), false);

  // 2. In non-production, localhost is permitted for development convenience
  const devOrigins = getAllowedOrigins({
    frontendUrl: "https://iconelectromatic.com",
    isProduction: false,
  });
  assert.equal(devOrigins.has("https://iconelectromatic.com"), true);
  assert.equal(devOrigins.has("http://localhost:5173"), true);
  assert.equal(devOrigins.has("http://localhost:3000"), true);
});

// ── 4. TRUST_PROXY CONFIGURATION ───────────────────────────────────────────────

test("configureTrustProxy configures Express based on deployment topology", () => {
  const testApp1 = { settings: {}, set(k, v) { this.settings[k] = v; } };
  configureTrustProxy(testApp1, undefined);
  assert.equal(testApp1.settings["trust proxy"], false);

  const testApp2 = { settings: {}, set(k, v) { this.settings[k] = v; } };
  configureTrustProxy(testApp2, "1");
  assert.equal(testApp2.settings["trust proxy"], 1);

  const testApp3 = { settings: {}, set(k, v) { this.settings[k] = v; } };
  configureTrustProxy(testApp3, "loopback, 10.0.0.0/8");
  assert.equal(testApp3.settings["trust proxy"], "loopback, 10.0.0.0/8");

  const testApp4 = { settings: {}, set(k, v) { this.settings[k] = v; } };
  configureTrustProxy(testApp4, "false");
  assert.equal(testApp4.settings["trust proxy"], false);
});

// ── 5. PRODUCTION COOKIE SETTINGS ──────────────────────────────────────────────

test("Production cookies use __Host- prefix, Secure, HttpOnly, and SameSite=Lax", () => {
  const prodNames = getAuthCookieNames(true);
  assert.equal(prodNames.session, "__Host-admin_session");
  assert.equal(prodNames.csrf, "__Host-admin_csrf");

  const headers = [];
  const mockRes = {
    append(key, val) {
      headers.push({ key, val });
    },
  };

  appendAuthCookies(mockRes, {
    sessionToken: "session-opaque-token-12345",
    csrfToken: "csrf-opaque-token-12345",
    maxAgeSeconds: 3600,
    isProduction: true,
  });

  const sessionCookie = headers.find((h) => h.val.startsWith("__Host-admin_session=")).val;
  const csrfCookie = headers.find((h) => h.val.startsWith("__Host-admin_csrf=")).val;

  // Session cookie must have HttpOnly, Secure, SameSite=Lax, Path=/
  assert.match(sessionCookie, /Path=\//);
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /Secure/);
  assert.match(sessionCookie, /SameSite=Lax/);

  // CSRF cookie must have Secure, SameSite=Lax, Path=/ (readable by JS, so no HttpOnly)
  assert.match(csrfCookie, /Path=\//);
  assert.match(csrfCookie, /Secure/);
  assert.match(csrfCookie, /SameSite=Lax/);
  assert.equal(csrfCookie.includes("HttpOnly"), false);
});

// ── 6. SAFE ERROR HANDLING & PAYLOAD LIMITS ────────────────────────────────────

test("Global error handler returns clean JSON for 400, 413, 404, and 500", async () => {
  const customRoutes = [
    {
      path: "/api/test-error",
      handler: (_req, _res, next) => {
        next(new Error("Sensitive database connection details leaked!"));
      },
    },
  ];

  const app = createApp({ customRoutes, isProduction: false });

  await withServer(app, async (baseUrl) => {
    // 1. Malformed JSON returns 400
    const malformedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json string",
    });
    assert.equal(malformedRes.status, 400);
    const malformedJson = await malformedRes.json();
    assert.equal(malformedJson.message, "Invalid JSON request body.");

    // 2. Oversized payload returns 413
    const oversizedBody = JSON.stringify({ data: "x".repeat(300 * 1024) }); // 300 KB > 250 KB limit
    const oversizedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedBody,
    });
    assert.equal(oversizedRes.status, 413);
    const oversizedJson = await oversizedRes.json();
    assert.equal(oversizedJson.message, "Request body is too large.");

    // 3. Unexpected 500 error hides stack traces and message internals
    const errorRes = await fetch(`${baseUrl}/api/test-error`);
    assert.equal(errorRes.status, 500);
    const errorJson = await errorRes.json();
    assert.equal(errorJson.success, false);
    assert.equal(errorJson.message, "Internal server error.");
    assert.equal(errorJson.stack, undefined);

    // 4. Unknown route returns JSON 404 (not HTML)
    const notFoundRes = await fetch(`${baseUrl}/random-unknown-route`);
    assert.equal(notFoundRes.status, 404);
    assert.match(notFoundRes.headers.get("content-type"), /application\/json/);
    const notFoundJson = await notFoundRes.json();
    assert.equal(notFoundJson.success, false);
    assert.match(notFoundJson.message, /route not found/i);
  });
});
