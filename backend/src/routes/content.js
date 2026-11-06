/**
 * content.js — API endpoints for database-backed CMS site content.
 *
 * Public routes (createContentRouter):
 *   GET /api/content/:pageKey        — Get published content for a page (or null with isDefault: true)
 *                                      Includes Cache-Control (s-maxage=60, stale-while-revalidate=300) and ETag support.
 *
 * Admin routes (createAdminContentRouter, protected by requireAdmin):
 *   GET /api/admin/content           — List all saved content keys and update timestamps (Cache-Control: no-store)
 *   GET /api/admin/content/:pageKey  — Get content for CMS editor with audit metadata (updatedBy)
 *   PUT /api/admin/content/:pageKey  — Create or update content (persisted to PostgreSQL SiteContent)
 *                                      Supports optimistic concurrency check via expectedUpdatedAt.
 */

import { Router } from "express";
import prisma from "../db.js";
import { asyncHandler } from "./common.js";
import defaultRequireAdmin from "../middleware/requireAdmin.js";

const PAGE_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Validate that a pageKey matches the allowed identifier pattern.
 * @param {string} key
 * @returns {boolean}
 */
export function isValidPageKey(key) {
  return typeof key === "string" && PAGE_KEY_RE.test(key.trim());
}

/**
 * Generate a weak ETag string for a content record or default key.
 * @param {string} pageKey
 * @param {Date|string|null} [updatedAt]
 * @returns {string}
 */
export function generateContentEtag(pageKey, updatedAt = null) {
  if (updatedAt) {
    const ts = new Date(updatedAt).getTime();
    return `W/"${pageKey}-${ts}"`;
  }
  return `W/"default-${pageKey}"`;
}

/**
 * Factory for public content retrieval router (GET /api/content/:pageKey).
 * @param {object} options
 * @param {object} [options.prismaClient] - Prisma client instance
 * @returns {Router}
 */
export function createContentRouter({ prismaClient = prisma } = {}) {
  const router = Router();

  /**
   * GET /:pageKey
   * Public endpoint to retrieve content for a given page/section.
   * Returns HTTP 200 with content or { content: null, isDefault: true } if uncustomized.
   * Supports HTTP 304 Not Modified when client sends a matching If-None-Match header.
   */
  router.get(
    "/:pageKey",
    asyncHandler(async (req, res) => {
      const pageKey = (req.params.pageKey || "").trim();

      if (!isValidPageKey(pageKey)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pageKey format. Must be 1-64 alphanumeric characters, hyphens, or underscores.",
        });
      }

      const record = await prismaClient.siteContent.findUnique({
        where: { pageKey },
        select: {
          pageKey: true,
          content: true,
          updatedAt: true,
        },
      });

      const etag = generateContentEtag(pageKey, record?.updatedAt);

      res.setHeader(
        "Cache-Control",
        "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
      );
      res.setHeader("ETag", etag);

      // HTTP 304 Not Modified revalidation check
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag && clientEtag === etag) {
        return res.status(304).end();
      }

      if (!record) {
        return res.status(200).json({
          success: true,
          pageKey,
          content: null,
          isDefault: true,
        });
      }

      return res.status(200).json({
        success: true,
        pageKey: record.pageKey,
        content: record.content,
        updatedAt: record.updatedAt,
        isDefault: false,
      });
    })
  );

  return router;
}

/**
 * Factory for admin content management router (mounted at /api/admin/content).
 * All routes are gated by requireAdminMiddleware.
 * @param {object} options
 * @param {object} [options.prismaClient] - Prisma client instance
 * @param {Function} [options.requireAdminMiddleware] - Authentication middleware
 * @returns {Router}
 */
export function createAdminContentRouter({
  prismaClient = prisma,
  requireAdminMiddleware = defaultRequireAdmin,
} = {}) {
  const router = Router();

  // All admin content routes require authenticated admin session
  router.use(requireAdminMiddleware);

  // Enforce no-store on all admin endpoints to prevent proxy/browser caching
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  /**
   * GET / (or GET /api/admin/content)
   * List all saved content sections and their last-updated timestamps.
   */
  router.get(
    "/",
    asyncHandler(async (_req, res) => {
      const items = await prismaClient.siteContent.findMany({
        select: {
          id: true,
          pageKey: true,
          updatedAt: true,
          updatedBy: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { pageKey: "asc" },
      });

      return res.status(200).json({
        success: true,
        items,
        count: items.length,
      });
    })
  );

  /**
   * GET /:pageKey (or GET /api/admin/content/:pageKey)
   * Retrieve content with full admin audit metadata.
   */
  router.get(
    "/:pageKey",
    asyncHandler(async (req, res) => {
      const pageKey = (req.params.pageKey || "").trim();

      if (!isValidPageKey(pageKey)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pageKey format.",
        });
      }

      const record = await prismaClient.siteContent.findUnique({
        where: { pageKey },
        select: {
          id: true,
          pageKey: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!record) {
        return res.status(200).json({
          success: true,
          pageKey,
          content: null,
          isDefault: true,
        });
      }

      return res.status(200).json({
        success: true,
        pageKey: record.pageKey,
        content: record.content,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
        isDefault: false,
      });
    })
  );

  /**
   * PUT /:pageKey (or PUT /api/admin/content/:pageKey)
   * Create or update non-catalog CMS content in PostgreSQL.
   * Performs optimistic concurrency check when expectedUpdatedAt is supplied.
   */
  router.put(
    "/:pageKey",
    asyncHandler(async (req, res) => {
      const pageKey = (req.params.pageKey || "").trim();

      if (!isValidPageKey(pageKey)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pageKey format.",
        });
      }

      const { content, expectedUpdatedAt } = req.body;

      if (content === undefined || content === null || typeof content !== "object") {
        return res.status(400).json({
          success: false,
          message: "Request body must include a valid 'content' object or array.",
        });
      }

      // Optimistic concurrency check
      if (expectedUpdatedAt) {
        const existing = await prismaClient.siteContent.findUnique({
          where: { pageKey },
          select: { updatedAt: true },
        });

        if (existing && existing.updatedAt) {
          const existingTs = new Date(existing.updatedAt).getTime();
          const expectedTs = new Date(expectedUpdatedAt).getTime();

          if (!isNaN(expectedTs) && existingTs > expectedTs) {
            return res.status(409).json({
              success: false,
              code: "CONCURRENT_MODIFICATION",
              message: `This section was modified by another administrator at ${existing.updatedAt.toISOString()}. Please reload the latest content before saving.`,
              currentUpdatedAt: existing.updatedAt,
            });
          }
        }
      }

      const updatedById = req.adminUser?.id || null;

      const saved = await prismaClient.siteContent.upsert({
        where: { pageKey },
        create: {
          pageKey,
          content,
          updatedById,
        },
        update: {
          content,
          updatedById,
        },
        select: {
          id: true,
          pageKey: true,
          content: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Content for '${pageKey}' saved successfully.`,
        pageKey: saved.pageKey,
        content: saved.content,
        updatedAt: saved.updatedAt,
      });
    })
  );

  return router;
}

export default createContentRouter();
