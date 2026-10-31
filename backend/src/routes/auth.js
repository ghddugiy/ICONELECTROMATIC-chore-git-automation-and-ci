import { Router } from "express";
import prisma from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import loginRateLimit from "../middleware/loginRateLimit.js";
import {
  appendAuthCookies,
  clearAuthCookies,
  createOpaqueToken,
  getAuthCookieNames,
  hashOpaqueToken,
  readCookie,
  verifyPassword,
} from "../auth/security.js";

const router = Router();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalidRequest(res) {
  return res.status(400).json({
    success: false,
    message: "Invalid login request.",
  });
}

function invalidCredentials(res) {
  return res.status(401).json({
    success: false,
    message: "Invalid email or password.",
  });
}

function isValidLoginBody(body) {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !["email", "password"].includes(key))
  ) {
    return false;
  }

  return (
    typeof body.email === "string" &&
    body.email.trim().length <= 254 &&
    EMAIL_PATTERN.test(body.email.trim()) &&
    typeof body.password === "string" &&
    body.password.length > 0 &&
    body.password.length <= 1024
  );
}

export function createAuthRouter({
  prismaClient = prisma,
  requireAdminMiddleware = requireAdmin,
  loginRateLimitMiddleware = loginRateLimit,
  now = () => new Date(),
  isProduction = process.env.NODE_ENV === "production",
} = {}) {
  const router = Router();

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    return next();
  });

  router.post("/login", loginRateLimitMiddleware, async (req, res) => {
    if (!isValidLoginBody(req.body)) {
      req.loginSecurity?.recordFailure(req.body?.email);
      return invalidRequest(res);
    }

    try {
      const email = req.body.email.trim().toLowerCase();
      const user = await prismaClient.adminUser.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          active: true,
        },
      });

      const passwordIsValid = await verifyPassword(
        req.body.password,
        user?.passwordHash
      );
      if (
        !user ||
        !user.active ||
        user.role !== "ADMIN" ||
        !passwordIsValid
      ) {
        req.loginSecurity?.recordFailure(email);
        return invalidCredentials(res);
      }

      // Successful authentication: reset failed-attempt counter for IP and email
      req.loginSecurity?.recordSuccess(email);

      const sessionToken = createOpaqueToken();
      const csrfToken = createOpaqueToken();
      const expiresAt = new Date(now().getTime() + SESSION_DURATION_MS);
      await prismaClient.adminSession.create({
        data: {
          adminUserId: user.id,
          tokenHash: hashOpaqueToken(sessionToken),
          csrfTokenHash: hashOpaqueToken(csrfToken),
          absoluteExpiresAt: expiresAt,
        },
        select: { id: true },
      });

      appendAuthCookies(res, {
        sessionToken,
        csrfToken,
        maxAgeSeconds: SESSION_DURATION_MS / 1000,
        isProduction,
      });

      return res.status(200).json({
        success: true,
        data: {
          admin: { id: user.id, email: user.email, role: user.role },
          csrfToken,
          expiresAt,
        },
      });
    } catch {
      return res.status(503).json({
        success: false,
        message: "Authentication service is unavailable.",
      });
    }
  });

  router.get("/session", requireAdminMiddleware, (req, res) => {
    const cookieNames = getAuthCookieNames(isProduction);
    const csrfToken = readCookie(req.headers.cookie, cookieNames.csrf);

    return res.status(200).json({
      success: true,
      data: {
        admin: req.adminUser,
        csrfToken,
      },
    });
  });

  router.post("/logout", requireAdminMiddleware, async (req, res) => {
    try {
      await prismaClient.adminSession.updateMany({
        where: {
          id: req.adminSession.id,
          revokedAt: null,
        },
        data: { revokedAt: now() },
      });

      clearAuthCookies(res, isProduction);
      return res.status(200).json({
        success: true,
        data: { loggedOut: true },
      });
    } catch {
      return res.status(503).json({
        success: false,
        message: "Authentication service is unavailable.",
      });
    }
  });

  return router;
}

export default createAuthRouter();
