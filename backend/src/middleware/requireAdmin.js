import prisma from "../db.js";
import {
  getAuthCookieNames,
  hashOpaqueToken,
  hasValidCsrfRequest,
  readCookie,
} from "../auth/security.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createRequireAdmin({
  prismaClient = prisma,
  now = () => new Date(),
  isProduction = process.env.NODE_ENV === "production",
} = {}) {
  return async function requireAdmin(req, res, next) {
    const cookieNames = getAuthCookieNames(isProduction);
    const sessionToken = readCookie(
      req.headers.cookie,
      cookieNames.session
    );
    const tokenHash = hashOpaqueToken(sessionToken);

    if (!tokenHash) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    try {
      const currentTime = now();
      const session = await prismaClient.adminSession.findUnique({
        where: { tokenHash },
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              role: true,
              active: true,
            },
          },
        },
      });

      if (
        !session ||
        session.revokedAt !== null ||
        session.absoluteExpiresAt <= currentTime ||
        !session.adminUser.active
      ) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      if (session.adminUser.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Administrator access required.",
        });
      }

      const touchedSession = await prismaClient.adminSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          absoluteExpiresAt: { gt: currentTime },
        },
        data: { lastSeenAt: currentTime },
      });

      if (touchedSession.count !== 1) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      if (!SAFE_METHODS.has(req.method.toUpperCase())) {
        const validCsrf = hasValidCsrfRequest({
          cookieHeader: req.headers.cookie,
          csrfCookieName: cookieNames.csrf,
          csrfTokenHash: session.csrfTokenHash,
          headerToken: req.get("X-CSRF-Token"),
        });

        if (!validCsrf) {
          return res.status(403).json({
            success: false,
            message: "CSRF validation failed.",
          });
        }
      }

      req.adminUser = {
        id: session.adminUser.id,
        email: session.adminUser.email,
        role: session.adminUser.role,
      };
      req.adminSession = { id: session.id };
      return next();
    } catch {
      return res.status(503).json({
        success: false,
        message: "Authentication service is unavailable.",
      });
    }
  };
}

export default createRequireAdmin();
