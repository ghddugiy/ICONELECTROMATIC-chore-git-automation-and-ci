import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import prisma from "./db.js";
import authRoutes from "./routes/auth.js";
import oemRoutes from "./routes/oems.js";
import categoryRoutes from "./routes/categories.js";
import productRoutes from "./routes/products.js";
import transferRoutes from "./routes/transfer.js";
import mediaRoutes from "./routes/media.js";
import enquiriesRoutes from "./routes/enquiries.js";
import contentRoutes, { createContentRouter, createAdminContentRouter } from "./routes/content.js";
import { createAdminEnquiriesRouter } from "./routes/adminEnquiries.js";
import { createSitemapRouter } from "./routes/sitemap.js";

export class CorsForbiddenError extends Error {
  constructor(origin) {
    super(`Origin ${origin} not allowed by CORS`);
    this.name = "CorsForbiddenError";
    this.status = 403;
  }
}

export function getAllowedOrigins({
  frontendUrl = process.env.FRONTEND_URL,
  isProduction = process.env.NODE_ENV === "production",
} = {}) {
  const configured = (frontendUrl || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (isProduction) {
    return new Set(configured);
  }

  return new Set([
    ...configured,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ]);
}

export function configureTrustProxy(app, trustProxyEnv = process.env.TRUST_PROXY) {
  if (trustProxyEnv !== undefined && trustProxyEnv !== "") {
    if (trustProxyEnv === "true") {
      console.warn(
        "WARNING: TRUST_PROXY=true trusts all proxy hops. Ensure your deployment is behind a proxy that sanitizes client headers."
      );
      app.set("trust proxy", true);
    } else if (trustProxyEnv === "false") {
      app.set("trust proxy", false);
    } else if (/^\d+$/.test(trustProxyEnv)) {
      app.set("trust proxy", parseInt(trustProxyEnv, 10));
    } else {
      app.set("trust proxy", trustProxyEnv);
    }
  } else {
    app.set("trust proxy", false);
  }
}

export function createApp({
  prismaClient = prisma,
  frontendUrl = process.env.FRONTEND_URL,
  isProduction = process.env.NODE_ENV === "production",
  trustProxy = process.env.TRUST_PROXY,
  authRouter = authRoutes,
  mediaRouter = mediaRoutes,
  sitemapRouter = null,
  contentRouter = null,
  adminContentRouter = null,
  adminEnquiriesRouter = null,
  customRoutes = [],
} = {}) {
  const app = express();

  app.disable("x-powered-by");
  configureTrustProxy(app, trustProxy);

  // Security headers: Helmet with crossOriginResourcePolicy for media delivery
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  );

  const allowedOrigins = getAllowedOrigins({ frontendUrl, isProduction });

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
        } else {
          callback(new CorsForbiddenError(origin));
        }
      },
      credentials: true,
    })
  );

  // Body parser limit (catalog transfer payloads reach ~115 KB; 250 KB headroom)
  app.use(express.json({ limit: "250kb" }));

  // Backend health check
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Icon Electromatic backend is running",
    });
  });

  // Database health check
  app.get("/api/health/db", async (_req, res) => {
    try {
      await prismaClient.$queryRaw`SELECT 1`;

      res.status(200).json({
        success: true,
        message: "PostgreSQL database connection is working",
        database: "connected",
      });
    } catch (error) {
      console.error("Database health check failed:", error.message);

      res.status(503).json({
        success: false,
        message: "Database connection failed",
        database: "disconnected",
      });
    }
  });

  // Mount API routes
  app.use("/api/auth", authRouter);
  app.use("/api/oems", oemRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/catalog/transfer", transferRoutes);
  app.use("/api/media", mediaRouter);
  app.use("/api/enquiries", enquiriesRoutes);

  // Database-backed CMS content routes (public read at /api/content/:pageKey, admin at /api/admin/content/:pageKey)
  const activeContentRouter = contentRouter || createContentRouter({ prismaClient });
  const activeAdminContentRouter = adminContentRouter || createAdminContentRouter({ prismaClient });
  app.use("/api/content", activeContentRouter);
  app.use("/api/admin/content", activeAdminContentRouter);

  // Authenticated Admin Enquiry Workflow & Communication routes
  const activeAdminEnquiriesRouter =
    adminEnquiriesRouter || createAdminEnquiriesRouter({ prismaClient });
  app.use("/api/admin/enquiries", activeAdminEnquiriesRouter);

  // Dynamic sitemap routes (publicly accessible at both /sitemap.xml and /api/sitemap.xml)
  const activeSitemapRouter = sitemapRouter || createSitemapRouter({ prismaClient });
  app.use("/sitemap.xml", activeSitemapRouter);
  app.use("/api/sitemap.xml", activeSitemapRouter);

  // Mount any custom/test routes before 404 handler
  for (const route of customRoutes) {
    if (route.path && route.handler) {
      app.use(route.path, route.handler);
    }
  }

  // Catch-all route handler for unknown routes (returns JSON, avoids default Express HTML)
  app.use((req, res) => {
    const isApi = req.originalUrl.startsWith("/api");
    res.status(404).json({
      success: false,
      message: isApi
        ? `API route not found: ${req.method} ${req.originalUrl}`
        : `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global error handler
  app.use((error, _req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    // Handle CORS rejections cleanly without logging an unhandled 500 error
    if (
      error.name === "CorsForbiddenError" ||
      (typeof error.message === "string" && error.message.includes("not allowed by CORS"))
    ) {
      return res.status(403).json({
        success: false,
        message: "CORS request forbidden: origin not allowed.",
      });
    }

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

    if (statusCode >= 500) {
      console.error("Unhandled request error:", error);
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  });

  return app;
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────

/**
 * Maximum milliseconds to wait for in-flight HTTP requests and Prisma
 * disconnection to complete before forcing the process to exit.
 * Exported so tests can reference the production default.
 */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

function safeProcessErrorDetails(error, env = process.env) {
  let details;
  if (error instanceof Error) {
    details = `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  } else if (typeof error === "string") {
    details = error;
  } else {
    details = String(error);
  }

  details = details.replace(
    /\b(postgres(?:ql)?|mysql|redis):\/\/[^\s/@]+@/gi,
    "$1://[REDACTED]@"
  );
  const sensitiveValues = Object.entries(env)
    .filter(([name, value]) =>
      /(?:PASSWORD|SECRET|TOKEN|API_KEY|DATABASE_URL)/i.test(name) &&
      typeof value === "string" &&
      value.length > 0
    )
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length);

  for (const value of sensitiveValues) {
    details = details.split(value).join("[REDACTED]");
  }

  return details;
}

export function createProcessErrorHandlers({
  processObject = process,
  shutdown,
  errorLogger = console.error,
  env = process.env,
} = {}) {
  if (typeof shutdown !== "function") {
    throw new TypeError("A shutdown handler is required.");
  }

  const onUnhandledRejection = (reason) =>
    reportFatalError("unhandledRejection", reason);
  const onUncaughtException = (error) =>
    reportFatalError("uncaughtException", error);

  function exitAfterShutdownFailure(error) {
    errorLogger(
      "[process] Fatal-error shutdown failed:\n" +
        safeProcessErrorDetails(error, env)
    );
    if (typeof processObject.exit === "function") {
      processObject.exit(1);
    }
  }

  function reportFatalError(event, error) {
    errorLogger(`[process] ${event}; shutting down:\n${safeProcessErrorDetails(error, env)}`);
    try {
      Promise.resolve(shutdown(event, 1)).catch(exitAfterShutdownFailure);
    } catch (shutdownError) {
      exitAfterShutdownFailure(shutdownError);
    }
  }

  processObject.on("unhandledRejection", onUnhandledRejection);
  processObject.on("uncaughtException", onUncaughtException);

  return function removeProcessErrorHandlers() {
    processObject.off("unhandledRejection", onUnhandledRejection);
    processObject.off("uncaughtException", onUncaughtException);
  };
}

/**
 * Returns a shutdown function that stops the HTTP server gracefully, then
 * disconnects Prisma. Designed to be called from SIGTERM / SIGINT handlers.
 *
 * @param {object} opts
 * @param {import('http').Server} opts.serverInstance - The running HTTP server.
 * @param {object}               opts.prismaClient   - Prisma client with $disconnect().
 * @param {number}               opts.timeoutMs      - Force-exit deadline in ms (default 10 s).
 * @param {function}             opts.onExit         - Replacement for process.exit (injectable for tests).
 */
export function createShutdownHandler({
  serverInstance,
  prismaClient,
  timeoutMs = SHUTDOWN_TIMEOUT_MS,
  onExit = (code) => process.exit(code),
} = {}) {
  let isShuttingDown = false;
  let requestedExitCode = 0;

  return async function shutdown(signal, exitCode = 0) {
    // A fatal process error must override an earlier clean signal shutdown.
    if (isShuttingDown) {
      if (exitCode !== 0) requestedExitCode = exitCode;
      return;
    }
    isShuttingDown = true;
    requestedExitCode = exitCode;

    console.info(`[shutdown] Received ${signal}. Starting graceful shutdown…`);

    // Safety net: force-exit after timeoutMs so the process cannot hang forever.
    // timer.unref() ensures the timer itself does not keep the event loop alive
    // if everything else has already finished.
    const timer = setTimeout(() => {
      console.error("[shutdown] Shutdown timeout exceeded. Forcing process exit.");
      onExit(1);
    }, timeoutMs);
    timer.unref();

    // Drop idle keep-alive connections immediately so the server drains faster.
    // closeIdleConnections() is available in Node.js ≥ 18.2; guard for safety.
    if (typeof serverInstance.closeIdleConnections === "function") {
      serverInstance.closeIdleConnections();
    }

    // Stop accepting new connections; wait for in-flight requests to finish.
    serverInstance.close(async () => {
      console.info("[shutdown] HTTP server closed.");

      // Disconnect Prisma only after the HTTP server has fully drained.
      try {
        await prismaClient.$disconnect();
        console.info("[shutdown] Prisma disconnected. Shutdown complete.");
        clearTimeout(timer);
        onExit(requestedExitCode);
      } catch (err) {
        // Database cleanup failed — report failure so the orchestrator can restart.
        console.error(
          "[shutdown] Prisma disconnect error:",
          safeProcessErrorDetails(err)
        );
        clearTimeout(timer);
        onExit(1);
      }
    });
  };
}

// ── Boot block (runs only when this file is started directly) ─────────────────

const app = createApp();
let server = null;

const isDirectRun =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("server.js") || process.argv[1].endsWith("server.mjs"));

if (isDirectRun) {
  const port = Number(process.env.PORT || 5000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(
      `Invalid PORT value "${process.env.PORT}". Set PORT to a number between 1 and 65535.`
    );
    process.exit(1);
  }

  const allowedOrigins = getAllowedOrigins();

  server = app.listen(port, () => {
    console.info(
      `Icon Electromatic backend listening on http://localhost:${port}`
    );
    console.info(`CORS allowed origins: ${[...allowedOrigins].join(", ") || "(none configured)"}`);
  });

  server.on("error", (error) => {
    console.error(
      `Failed to start backend on port ${port}: ${error.message}`
    );
    process.exitCode = 1;
  });

  // Register signal handlers only in direct-run mode, never during tests.
  const shutdown = createShutdownHandler({
    serverInstance: server,
    prismaClient: prisma,
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
  createProcessErrorHandlers({ shutdown });
}

export default app;
export { app, server };
