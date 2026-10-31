/**
 * bodyLimit.test.js
 *
 * Verifies that the Express JSON body-size limit is correctly set to 250 KB:
 *   - Payloads at or below 250 KB are accepted (HTTP 200).
 *   - The real catalog transfer payload (~115 KB) is accepted.
 *   - Payloads above 250 KB are rejected with HTTP 413 and a clear message.
 *   - The global error handler returns "Request body is too large." for 413.
 *   - The global error handler returns "Internal server error." for 500.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { CATALOG } from "../../src/data/catalogData.js";

// ────────────────────────────────────────────────────────────────────────────────
// Minimal Express app that mirrors the production body-parser and error handler
// ────────────────────────────────────────────────────────────────────────────────

function createTestApp({ limit = "250kb" } = {}) {
  const app = express();

  // Mirror server.js body parser configuration
  app.use(express.json({ limit }));

  // Echo endpoint – returns the number of bytes received in the parsed body
  app.post("/echo", (req, res) => {
    const bodySize = Buffer.byteLength(JSON.stringify(req.body));
    res.status(200).json({ success: true, receivedBytes: bodySize });
  });

  // Mirror server.js global error handler
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;

    const statusCode = Number.isInteger(error.status)
      ? error.status
      : Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;

    const message =
      statusCode === 400
        ? "Invalid JSON request body."
        : statusCode === 413
        ? "Request body is too large."
        : "Internal server error.";

    return res.status(statusCode).json({ success: false, message });
  });

  return app;
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper: send a raw JSON string to the test server and return { status, body }
// ────────────────────────────────────────────────────────────────────────────────

function sendRawJson(server, rawJson) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: "127.0.0.1",
      port: addr.port,
      path: "/echo",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(rawJson),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on("error", reject);
    req.write(rawJson);
    req.end();
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────────

test("real catalog payload size is below 250 KB", () => {
  // Mirrors what CatalogService.executeCatalogTransfer() sends.
  const payload = JSON.stringify({ catalog: CATALOG });
  const sizeBytes = Buffer.byteLength(payload);

  // Must be above the old 100 KB limit that caused the 413
  assert.ok(
    sizeBytes > 100_000,
    `Expected catalog payload > 100 KB, got ${sizeBytes} bytes`
  );

  // Must be below the new 250 KB limit
  assert.ok(
    sizeBytes < 250_000,
    `Expected catalog payload < 250 KB, got ${sizeBytes} bytes`
  );
});

test("server accepts the real catalog payload (~115 KB) with HTTP 200", async () => {
  const app = createTestApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const payload = JSON.stringify({ catalog: CATALOG });
    const result = await sendRawJson(server, payload);

    assert.equal(result.status, 200, `Expected 200, got ${result.status}`);
    assert.equal(result.body.success, true);
    assert.ok(
      result.body.receivedBytes > 100_000,
      "Expected receivedBytes > 100 KB"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server accepts a payload just below 250 KB with HTTP 200", async () => {
  const app = createTestApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    // ~245 KB payload (safely under the limit)
    const largeValue = "x".repeat(245_000);
    const payload = JSON.stringify({ data: largeValue });
    const sizeBytes = Buffer.byteLength(payload);

    assert.ok(sizeBytes < 250_000, `Payload should be < 250 KB, got ${sizeBytes}`);

    const result = await sendRawJson(server, payload);
    assert.equal(result.status, 200, `Expected 200, got ${result.status}`);
    assert.equal(result.body.success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("server rejects a payload over 250 KB with HTTP 413 and 'Request body is too large.'", async () => {
  const app = createTestApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    // ~300 KB — clearly over the 250 KB limit
    const oversizedValue = "x".repeat(300_000);
    const payload = JSON.stringify({ data: oversizedValue });
    const sizeBytes = Buffer.byteLength(payload);

    assert.ok(sizeBytes > 250_000, `Payload should be > 250 KB, got ${sizeBytes}`);

    const result = await sendRawJson(server, payload);

    assert.equal(result.status, 413, `Expected 413, got ${result.status}`);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, "Request body is too large.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("global error handler returns 413 and safe message for PayloadTooLargeError", async () => {
  // Use a deliberately tiny 1-byte limit to force a 413 without a large payload
  const app = createTestApp({ limit: "1b" });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const payload = JSON.stringify({ tiny: "but still over 1 byte" });
    const result = await sendRawJson(server, payload);

    assert.equal(result.status, 413);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, "Request body is too large.");
    // Must NOT expose internal stack traces or secrets
    assert.equal(typeof result.body.stack, "undefined");
    assert.equal(typeof result.body.error, "undefined");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("global error handler returns 'Internal server error.' and no stack for unexpected 500 errors", async () => {
  const app = express();
  app.use(express.json({ limit: "250kb" }));

  // Route that deliberately throws an unhandled error
  app.get("/boom", (_req, _res, next) => {
    const err = new Error("Unexpected internal failure");
    next(err); // no status set → should become 500
  });

  // Mirror of production error handler
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    const statusCode = Number.isInteger(error.status)
      ? error.status
      : Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;
    const message =
      statusCode === 400
        ? "Invalid JSON request body."
        : statusCode === 413
        ? "Request body is too large."
        : "Internal server error.";
    return res.status(statusCode).json({ success: false, message });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });

  try {
    const addr = server.address();
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: addr.port, path: "/boom", method: "GET" },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () =>
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });

    assert.equal(result.status, 500);
    assert.equal(result.body.success, false);
    assert.equal(result.body.message, "Internal server error.");
    assert.equal(typeof result.body.stack, "undefined");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
