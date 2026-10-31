import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cors from "cors";
import { ApiService } from "../../src/data/ApiService.js";
import {
  createOpaqueToken,
  createPasswordHash,
  getAuthCookieNames,
  hashOpaqueToken,
  hasValidCsrfRequest,
  readCookie,
  tokenMatchesHash,
  verifyPassword,
} from "../src/auth/security.js";
import { createAttemptLimiter } from "../src/middleware/loginRateLimit.js";
import { createRequireAdmin } from "../src/middleware/requireAdmin.js";
import { createAuthRouter } from "../src/routes/auth.js";

test("password hashes verify without storing the password", async () => {
  const password = "correct horse battery staple";
  const passwordHash = await createPasswordHash(password);

  assert.match(passwordHash, /^scrypt\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(passwordHash.includes(password), false);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("incorrect password", passwordHash), false);
  assert.equal(await verifyPassword(password, null), false);
});

test("opaque tokens are random-looking and only their hashes are stored", () => {
  const token = createOpaqueToken();
  const tokenHash = hashOpaqueToken(token);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(token, tokenHash);
  assert.equal(tokenMatchesHash(token, tokenHash), true);
  assert.equal(tokenMatchesHash("invalid", tokenHash), false);
});

test("CSRF requires matching cookie, header, and stored token hash", () => {
  const csrfToken = createOpaqueToken();
  const csrfTokenHash = hashOpaqueToken(csrfToken);
  const csrfCookieName = getAuthCookieNames(false).csrf;

  assert.equal(
    hasValidCsrfRequest({
      cookieHeader: `admin_csrf=${csrfToken}`,
      csrfCookieName,
      csrfTokenHash,
      headerToken: csrfToken,
    }),
    true
  );
  assert.equal(
    hasValidCsrfRequest({
      cookieHeader: `admin_csrf=${csrfToken}`,
      csrfCookieName,
      csrfTokenHash,
      headerToken: createOpaqueToken(),
    }),
    false
  );
  assert.equal(readCookie(`admin_csrf=${csrfToken}; admin_csrf=${csrfToken}`, csrfCookieName), null);
});

test("login attempt limiter blocks at the threshold and resets after window", () => {
  let currentTime = 1000;
  const limiter = createAttemptLimiter({
    maxAttempts: 2,
    windowMs: 1000,
    maxClients: 2,
    now: () => currentTime,
  });

  assert.equal(limiter.consume("client-a").allowed, true);
  assert.equal(limiter.consume("client-a").allowed, true);
  assert.equal(limiter.consume("client-a").allowed, false);
  currentTime += 1000;
  assert.equal(limiter.consume("client-a").allowed, true);
});

test("admin middleware rejects missing sessions and enforces CSRF", async () => {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const session = {
    id: "session-id",
    csrfTokenHash: hashOpaqueToken(csrfToken),
    revokedAt: null,
    absoluteExpiresAt: new Date(Date.now() + 60_000),
    adminUser: {
      id: "admin-id",
      email: "admin@example.invalid",
      role: "ADMIN",
      active: true,
    },
  };
  const prismaClient = {
    adminSession: {
      findUnique: async () => session,
      updateMany: async () => ({ count: 1 }),
    },
  };
  const middleware = createRequireAdmin({ prismaClient });
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  let nextCalled = false;
  await middleware(
    { method: "PATCH", headers: {}, get: () => undefined },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);

  response.statusCode = null;
  await middleware(
    {
      method: "PATCH",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
      },
      get: () => "wrong-csrf",
    },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);

  response.statusCode = null;
  await middleware(
    {
      method: "PATCH",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
      },
      get: () => csrfToken,
    },
    response,
    () => {
      nextCalled = true;
    }
  );
  assert.equal(response.statusCode, null);
  assert.equal(nextCalled, true);
});

test("admin middleware rejects expired sessions and non-admin roles", async () => {
  const sessionToken = createOpaqueToken();
  const session = {
    id: "session-id",
    csrfTokenHash: hashOpaqueToken(createOpaqueToken()),
    revokedAt: null,
    absoluteExpiresAt: new Date(1000),
    adminUser: {
      id: "editor-id",
      email: "editor@example.invalid",
      role: "EDITOR",
      active: true,
    },
  };
  const prismaClient = {
    adminSession: {
      findUnique: async () => session,
      updateMany: async () => ({ count: 1 }),
    },
  };
  const middleware = createRequireAdmin({
    prismaClient,
    now: () => new Date(2000),
  });
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  const req = {
    method: "GET",
    headers: { cookie: `admin_session=${sessionToken}` },
    get: () => undefined,
  };

  await middleware(req, response, () => {
    assert.fail("Expired session must not reach the protected route.");
  });
  assert.equal(response.statusCode, 401);

  session.absoluteExpiresAt = new Date(3000);
  await middleware(req, response, () => {
    assert.fail("Non-admin account must not reach admin routes.");
  });
  assert.equal(response.statusCode, 403);
});

test("auth endpoints log in, report the session, enforce CSRF, and revoke logout", async () => {
  const password = "correct horse battery staple";
  const passwordHash = await createPasswordHash(password);
  const admin = {
    id: "admin-id",
    email: "admin@example.invalid",
    passwordHash,
    role: "ADMIN",
    active: true,
  };
  let storedSession = null;
  const prismaClient = {
    adminUser: {
      findUnique: async ({ where }) =>
        where.email === admin.email ? admin : null,
    },
    adminSession: {
      create: async ({ data }) => {
        storedSession = {
          id: "session-id",
          ...data,
          revokedAt: null,
          adminUser: {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            active: admin.active,
          },
        };
        return { id: storedSession.id };
      },
      findUnique: async ({ where }) =>
        storedSession?.tokenHash === where.tokenHash ? storedSession : null,
      updateMany: async ({ where, data }) => {
        if (
          storedSession?.id !== where.id ||
          storedSession.revokedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(storedSession, data);
        return { count: 1 };
      },
    },
  };
  const adminMiddleware = createRequireAdmin({ prismaClient });
  const app = express();
  app.use(express.json());
  app.use(
    "/api/auth",
    createAuthRouter({
      prismaClient,
      requireAdminMiddleware: adminMiddleware,
      loginRateLimitMiddleware: (_req, _res, next) => next(),
      isProduction: false,
    })
  );

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: admin.email, password }),
    });
    const loginBody = await loginResponse.json();
    const setCookie = loginResponse.headers.get("set-cookie");

    assert.equal(loginResponse.status, 200);
    assert.equal(loginBody.data.admin.email, admin.email);
    assert.equal(typeof loginBody.data.csrfToken, "string");
    assert.match(setCookie, /admin_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax/);
    assert.match(setCookie, /admin_csrf=[a-f0-9]{64}; Path=\/; SameSite=Lax/);

    const cookieHeader = setCookie
      .split(",")
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    assert.notEqual(storedSession.tokenHash, /admin_session=([a-f0-9]+)/.exec(cookieHeader)[1]);
    assert.notEqual(storedSession.csrfTokenHash, loginBody.data.csrfToken);

    const sessionResponse = await fetch(`${baseUrl}/session`, {
      headers: { Cookie: cookieHeader },
    });
    const sessionBody = await sessionResponse.json();
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionBody.data.csrfToken, loginBody.data.csrfToken);

    const logoutResponse = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "X-CSRF-Token": loginBody.data.csrfToken,
      },
    });
    assert.equal(logoutResponse.status, 200);
    assert.notEqual(storedSession.revokedAt, null);

    const revokedSessionResponse = await fetch(`${baseUrl}/session`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(revokedSessionResponse.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("CORS allows configured origins with credentials and rejects unauthorized origins", async () => {
  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ]);

  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
    })
  );
  app.get("/api/test-cors", (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) => {
    res.status(403).json({ error: err.message });
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const port = server.address().port;

    // Allowed origin http://localhost:3000
    const res3000 = await fetch(`http://127.0.0.1:${port}/api/test-cors`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(res3000.status, 200);
    assert.equal(res3000.headers.get("access-control-allow-origin"), "http://localhost:3000");
    assert.equal(res3000.headers.get("access-control-allow-credentials"), "true");

    // Allowed origin http://localhost:5173
    const res5173 = await fetch(`http://127.0.0.1:${port}/api/test-cors`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(res5173.status, 200);
    assert.equal(res5173.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(res5173.headers.get("access-control-allow-credentials"), "true");

    // Disallowed origin
    const resBad = await fetch(`http://127.0.0.1:${port}/api/test-cors`, {
      headers: { Origin: "http://evil-attacker.example" },
    });
    assert.equal(resBad.status, 403);
    assert.equal(resBad.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("ApiService.getSession handles 401 gracefully returning null and returns admin on 200", async () => {
  const originalFetch = globalThis.fetch;

  try {
    // 1. Mock 401 unauthorized (user logged out)
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ success: false, message: "Authentication required." }),
    });

    const loggedOutAdmin = await ApiService.getSession();
    assert.equal(loggedOutAdmin, null);
    assert.equal(ApiService.getCsrfToken(), null);

    // 2. Mock 200 success (user logged in)
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          admin: { id: "admin-1", email: "admin@iconelectromatic.com", role: "ADMIN" },
          csrfToken: "mock-valid-csrf-token",
        },
      }),
    });

    const loggedInAdmin = await ApiService.getSession();
    assert.equal(loggedInAdmin?.email, "admin@iconelectromatic.com");
    assert.equal(ApiService.getCsrfToken(), "mock-valid-csrf-token");

    // 3. Mock 500 server error (should throw ApiError, not return null)
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: "Database connection failed" }),
    });

    await assert.rejects(
      async () => {
        await ApiService.getSession();
      },
      (err) => {
        assert.equal(err.status, 500);
        assert.match(err.message, /Database connection failed/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
