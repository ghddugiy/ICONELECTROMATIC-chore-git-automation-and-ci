/**
 * server.test.js â€” Unit tests for createShutdownHandler()
 *
 * Strategy:
 *  - `onExit` is injected so process.exit() is never called.
 *  - Signal handlers on the live process are NOT registered (isDirectRun = false
 *    during node --test, so the boot block never runs).
 *  - Each test gets its own server instance and shutdown handler instance so
 *    the internal `isShuttingDown` flag cannot leak between tests.
 *  - Windows note: SIGTERM cannot be sent to the process via the shell
 *    (taskkill /F is a hard kill). All five tests exercise the shutdown logic
 *    by calling the returned function directly â€” full coverage without any
 *    shell-level signal delivery.
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import {
  createProcessErrorHandlers,
  createShutdownHandler,
  SHUTDOWN_TIMEOUT_MS,
} from "../src/server.js";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Bind a real HTTP server to an ephemeral port and return it. */
async function startTestServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

/**
 * Poll until predicate() returns true or the deadline passes.
 * Default 2 000 ms is plenty for async close + Prisma stub.
 */
function waitFor(predicate, ms = 2000, interval = 10) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + ms;
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() >= deadline) return reject(new Error("waitFor timeout"));
      setTimeout(check, interval);
    };
    check();
  });
}

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Test 1 â€” Happy path (SIGTERM):
 * Server closes, Prisma disconnects, onExit(0) is called.
 */
test("createShutdownHandler â€” SIGTERM path: closes server, disconnects Prisma, exits 0", async () => {
  const server = await startTestServer();
  let disconnectCalled = 0;
  let exitCode = null;

  const prismaStub = {
    $disconnect: async () => {
      disconnectCalled += 1;
    },
  };

  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: prismaStub,
    onExit: (code) => {
      exitCode = code;
    },
  });

  // Call the shutdown function directly â€” mirrors what process.on("SIGTERM") does.
  shutdown("SIGTERM");
  await waitFor(() => exitCode !== null);

  assert.equal(disconnectCalled, 1, "Prisma.$disconnect() called exactly once");
  assert.equal(exitCode, 0, "onExit called with 0 on clean shutdown");
});

/**
 * Test 2 â€” Double-call guard:
 * Calling shutdown twice fires only one close sequence.
 * Prisma.$disconnect() must be called exactly once.
 */
test("createShutdownHandler â€” double-call guard: second call is a no-op", async () => {
  const server = await startTestServer();
  let disconnectCalled = 0;
  let exitCode = null;

  const prismaStub = {
    $disconnect: async () => {
      disconnectCalled += 1;
    },
  };

  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: prismaStub,
    onExit: (code) => {
      exitCode = code;
    },
  });

  // Fire twice â€” the guard must absorb the second call.
  shutdown("SIGTERM");
  shutdown("SIGTERM");
  await waitFor(() => exitCode !== null);

  assert.equal(disconnectCalled, 1, "Prisma.$disconnect() called exactly once despite two shutdown calls");
  assert.equal(exitCode, 0, "onExit(0) called once");
});

/**
 * Test 3 â€” Ordering:
 * Prisma.$disconnect() must run AFTER the server.close() callback fires,
 * never before.
 */
test("createShutdownHandler â€” ordering: Prisma disconnect happens after HTTP server closes", async () => {
  const server = await startTestServer();
  const events = [];

  // Wrap server.close to record when the close completes.
  const originalClose = server.close.bind(server);
  server.close = (cb) => {
    originalClose(() => {
      events.push("server-closed");
      if (cb) cb();
    });
  };

  const prismaStub = {
    $disconnect: async () => {
      events.push("prisma-disconnect");
    },
  };

  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: prismaStub,
    onExit: () => {},
  });

  shutdown("SIGTERM");
  await waitFor(() => events.includes("prisma-disconnect"));

  const serverIdx = events.indexOf("server-closed");
  const prismaIdx = events.indexOf("prisma-disconnect");
  assert.ok(serverIdx !== -1, '"server-closed" event was recorded');
  assert.ok(prismaIdx !== -1, '"prisma-disconnect" event was recorded');
  assert.ok(
    serverIdx < prismaIdx,
    `server-closed (position ${serverIdx}) must precede prisma-disconnect (position ${prismaIdx})`
  );
});

/**
 * Test 4 â€” Prisma disconnect failure:
 * When $disconnect() throws, shutdown must log the error and call onExit(1).
 * It must NOT call onExit(0).
 */
test("createShutdownHandler â€” Prisma disconnect error: logs error and exits 1", async () => {
  const server = await startTestServer();
  let exitCode = null;

  const prismaStub = {
    $disconnect: async () => {
      throw new Error("DB gone away");
    },
  };

  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: prismaStub,
    onExit: (code) => {
      exitCode = code;
    },
  });

  shutdown("SIGTERM");
  await waitFor(() => exitCode !== null);

  assert.equal(exitCode, 1, "onExit called with 1 when Prisma disconnect throws");
});

/**
 * Test 5 â€” Timeout path:
 * When server.close() never fires its callback (e.g. a hung keep-alive
 * connection), the safety timer must call onExit(1) after timeoutMs.
 *
 * Uses a very short timeoutMs (50 ms) to keep the test fast.
 */
test("createShutdownHandler â€” timeout: force-exits with code 1 when server never closes", async () => {
  // Fake server whose close() deliberately never calls its callback.
  const hangingServer = {
    close: () => {
      /* intentionally never fires the callback â€” simulates a hung connection */
    },
    closeIdleConnections: () => {},
  };

  let exitCode = null;

  const prismaStub = {
    $disconnect: async () => {},
  };

  const shutdown = createShutdownHandler({
    serverInstance: hangingServer,
    prismaClient: prismaStub,
    timeoutMs: 50,
    onExit: (code) => {
      exitCode = code;
    },
  });

  // Do not await â€” the server never resolves, only the timeout fires.
  shutdown("SIGTERM");
  await waitFor(() => exitCode !== null, 2000);

  assert.equal(exitCode, 1, "onExit called with 1 on shutdown timeout");
});

/**
 * Sanity check â€” SHUTDOWN_TIMEOUT_MS is exported and is a positive integer.
 * Guards against accidental changes to the production default.
 */
test("SHUTDOWN_TIMEOUT_MS â€” exported constant is a positive integer (production default)", () => {
  assert.ok(
    Number.isInteger(SHUTDOWN_TIMEOUT_MS) && SHUTDOWN_TIMEOUT_MS > 0,
    `SHUTDOWN_TIMEOUT_MS must be a positive integer, got: ${SHUTDOWN_TIMEOUT_MS}`
  );
});

test("createShutdownHandler exits nonzero after gracefully handling fatal errors", async () => {
  const server = await startTestServer();
  let exitCode = null;
  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: { $disconnect: async () => {} },
    onExit: (code) => {
      exitCode = code;
    },
  });

  shutdown("uncaughtException", 1);
  await waitFor(() => exitCode !== null);

  assert.equal(exitCode, 1);
});

test("createShutdownHandler preserves fatal exit code when it arrives during signal shutdown", async () => {
  let closeCallback;
  let exitCode = null;
  const server = {
    close: (callback) => {
      closeCallback = callback;
    },
  };
  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: { $disconnect: async () => {} },
    onExit: (code) => {
      exitCode = code;
    },
  });

  shutdown("SIGTERM");
  await shutdown("uncaughtException", 1);
  closeCallback();
  await waitFor(() => exitCode !== null);

  assert.equal(exitCode, 1);
});

test("createProcessErrorHandlers logs redacted errors and initiates fatal shutdown", () => {
  const processObject = new EventEmitter();
  const calls = [];
  const logs = [];
  const env = {
    DATABASE_URL: "postgresql://db-user:db-password@db.example/catalog",
    RESEND_API_KEY: "mail-secret",
  };
  const removeHandlers = createProcessErrorHandlers({
    processObject,
    shutdown: (...args) => calls.push(args),
    errorLogger: (message) => logs.push(message),
    env,
  });

  processObject.emit(
    "unhandledRejection",
    new Error(`${env.DATABASE_URL} rejected with ${env.RESEND_API_KEY}`)
  );
  processObject.emit(
    "uncaughtException",
    new Error("Connection failed: postgres://user:password@database.example")
  );

  assert.deepEqual(calls, [
    ["unhandledRejection", 1],
    ["uncaughtException", 1],
  ]);
  assert.equal(logs.length, 2);
  assert.ok(logs[0].includes("Error:"));
  assert.ok(logs.every((message) => !message.includes("db-password")));
  assert.ok(logs.every((message) => !message.includes("mail-secret")));
  assert.ok(logs.every((message) => !message.includes("user:password")));

  removeHandlers();
  assert.equal(processObject.listenerCount("unhandledRejection"), 0);
  assert.equal(processObject.listenerCount("uncaughtException"), 0);
});

test("createProcessErrorHandlers exits nonzero when fatal shutdown fails", async () => {
  const processObject = new EventEmitter();
  const logs = [];
  const exitCodes = [];
  processObject.exit = (code) => exitCodes.push(code);
  const removeHandlers = createProcessErrorHandlers({
    processObject,
    shutdown: () => {
      throw new Error("shutdown failed");
    },
    errorLogger: (message) => logs.push(message),
  });

  processObject.emit("uncaughtException", new Error("fatal error"));
  await waitFor(() => exitCodes.length > 0);

  assert.deepEqual(exitCodes, [1]);
  assert.ok(logs.some((message) => message.includes("shutdown failed")));
  removeHandlers();
});
