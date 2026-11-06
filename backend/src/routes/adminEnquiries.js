/**
 * adminEnquiries.js — Authenticated Admin routes for enquiry workflow and communication management.
 *
 * Mounted at: /api/admin/enquiries
 * All routes are protected by requireAdmin middleware and double-submit CSRF checks.
 *
 * Routes registered (order matters):
 *   GET   /stats               — Summary counts by workflow status and region
 *   GET   /staff               — Active assignable staff members
 *   GET   /export              — Filtered enquiries export in RFC-4180 CSV with formula-injection guard
 *   GET   /                    — Paginated, filtered, searchable enquiry list
 *   GET   /:id                 — Single enquiry detail with chronological communication history
 *   PATCH /:id/status          — Update workflow status & auto-log STATUS_CHANGE communication
 *   PATCH /:id/assign          — Assign/reassign to staff & auto-log assignment history
 *   POST  /:id/communications  — Manually log CUSTOMER_REPLY, PHONE_LOG, or INTERNAL_NOTE
 *
 * NO DELETE ROUTE: Enquiries are preserved permanently; soft archiving is handled via ARCHIVED status.
 */

import { Router } from "express";
import prisma from "../db.js";
import { asyncHandler } from "./common.js";
import defaultRequireAdmin from "../middleware/requireAdmin.js";
import { formatEnquiryReference } from "../services/emailService.js";

export const ALLOWED_WORKFLOW_STATUSES = Object.freeze(
  new Set([
    "NEW",
    "ASSIGNED",
    "IN_PROGRESS",
    "QUOTED",
    "CONTACTED",
    "CLOSED",
    "ARCHIVED",
  ])
);

export const ALLOWED_MANUAL_COMM_TYPES = Object.freeze(
  new Set(["CUSTOMER_REPLY", "PHONE_LOG", "INTERNAL_NOTE"])
);

export const ALLOWED_REGIONS = Object.freeze(
  new Set(["INDIA", "SINGAPORE", "USA"])
);

/**
 * Sanitize cell value for RFC-4180 CSV export.
 * Includes UTF-8 compliance and Formula Injection Defense:
 * Neutralizes formulas even when preceded by arbitrary whitespace, tabs, carriage returns,
 * newlines, or ASCII control codes (\x00-\x20, \x7f).
 * Triggers: =, +, -, @, \t, \r
 */
export function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // Neutralize potential CSV formula injection in spreadsheet software
  if (/^[\s\x00-\x20\x7f]*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC-4180: If contains comma, double-quote, or newline, enclose in double quotes
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build Prisma where clause from query parameters for list & export routes.
 */
function buildEnquiriesFilter(query = {}) {
  const where = {};

  // Region filter
  if (query.region) {
    const raw = query.region.trim().toUpperCase();
    if (raw === "UNCLASSIFIED" || raw === "NULL") {
      where.region = null;
    } else if (ALLOWED_REGIONS.has(raw)) {
      where.region = raw;
    }
  }

  // Workflow status filter
  if (query.workflowStatus) {
    const raw = query.workflowStatus.trim().toUpperCase();
    if (ALLOWED_WORKFLOW_STATUSES.has(raw)) {
      where.workflowStatus = raw;
    }
  }

  // Staff assignee filter
  if (query.assignedToId) {
    const raw = query.assignedToId.trim();
    if (raw === "unassigned" || raw === "null") {
      where.assignedToId = null;
    } else if (raw) {
      where.assignedToId = raw;
    }
  }

  // Search filter across customer name, company, email, model, or ID
  if (query.search && typeof query.search === "string") {
    const term = query.search.trim();
    if (term) {
      where.OR = [
        { fullname: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { model: { contains: term, mode: "insensitive" } },
        { id: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  // Date range filters
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      if (!isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      if (!isNaN(d.getTime())) where.createdAt.lte = d;
    }
  }

  return where;
}

/**
 * Execute in transaction or fallback to direct client call (for lightweight test mocks).
 */
async function runInTransaction(prismaClient, fn) {
  if (typeof prismaClient.$transaction === "function") {
    return prismaClient.$transaction(fn);
  }
  return fn(prismaClient);
}

/**
 * Router factory for Admin Enquiries API
 */
export function createAdminEnquiriesRouter({
  prismaClient = prisma,
  requireAdminMiddleware = defaultRequireAdmin,
} = {}) {
  const router = Router();

  // Enforce requireAdmin on all admin enquiry endpoints
  router.use(requireAdminMiddleware);

  // Enforce no-store on all admin endpoints
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  // ── 1. GET /stats ─────────────────────────────────────────────────────────
  // Registered BEFORE /:id to prevent route shadowing
  router.get(
    "/stats",
    asyncHandler(async (_req, res) => {
      const [total, byStatusRaw, byRegionRaw] = await Promise.all([
        prismaClient.enquiry.count(),
        prismaClient.enquiry.groupBy({
          by: ["workflowStatus"],
          _count: { _all: true },
        }),
        prismaClient.enquiry.groupBy({
          by: ["region"],
          _count: { _all: true },
        }),
      ]);

      const byStatus = {
        NEW: 0,
        ASSIGNED: 0,
        IN_PROGRESS: 0,
        QUOTED: 0,
        CONTACTED: 0,
        CLOSED: 0,
        ARCHIVED: 0,
      };
      for (const item of byStatusRaw) {
        if (item.workflowStatus && byStatus[item.workflowStatus] !== undefined) {
          byStatus[item.workflowStatus] = item._count._all || item._count || 0;
        }
      }

      const byRegion = {
        INDIA: 0,
        SINGAPORE: 0,
        USA: 0,
        UNCLASSIFIED: 0,
      };
      for (const item of byRegionRaw) {
        if (item.region && byRegion[item.region] !== undefined) {
          byRegion[item.region] = item._count._all || item._count || 0;
        } else if (!item.region) {
          byRegion.UNCLASSIFIED += item._count._all || item._count || 0;
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          total,
          byStatus,
          byRegion,
        },
      });
    })
  );

  // ── 2. GET /staff ─────────────────────────────────────────────────────────
  // Registered BEFORE /:id to prevent route shadowing
  router.get(
    "/staff",
    asyncHandler(async (_req, res) => {
      const staff = await prismaClient.adminUser.findMany({
        where: { active: true },
        select: {
          id: true,
          email: true,
          role: true,
        },
        orderBy: [{ email: "asc" }],
      });

      return res.status(200).json({
        success: true,
        data: { staff },
      });
    })
  );

  // ── 3. CSV EXPORTS ───────────────────────────────────────────────────────
  // Registered BEFORE /:id to prevent route shadowing
  // Exports ALL matching filtered records (not just the current page)

  async function handleCommunicationsExport(req, res) {
    const where = buildEnquiriesFilter(req.query);

    const items = await prismaClient.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        fullname: true,
        company: true,
        email: true,
        region: true,
        workflowStatus: true,
        communications: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            createdAt: true,
            type: true,
            subject: true,
            body: true,
            metadata: true,
            author: {
              select: { email: true },
            },
          },
        },
      },
    });

    const commHeaders = [
      "Enquiry Reference",
      "Enquiry Submission Date (UTC)",
      "Customer Name",
      "Customer Email",
      "Company",
      "Target Office",
      "Current Workflow Status",
      "Communication ID",
      "Communication Date (UTC)",
      "Communication Type",
      "Author / System",
      "Subject / Action",
      "Communication Body / Notes",
      "Delivery Status",
      "Channel / Recipient",
    ];

    const commRows = [];
    for (const item of items) {
      const refCode = formatEnquiryReference(item.id);
      const enquiryDateStr = item.createdAt ? new Date(item.createdAt).toISOString() : "";
      const regionLabel = item.region || "Unclassified";
      const workflowStatus = item.workflowStatus || "NEW";

      for (const comm of item.communications || []) {
        const commDateStr = comm.createdAt ? new Date(comm.createdAt).toISOString() : "";
        const authorStr =
          comm.author?.email || (comm.type === "EMAIL_OUTBOUND" ? "Automated System" : "Staff");
        const meta = comm.metadata && typeof comm.metadata === "object" ? comm.metadata : {};
        const deliveryStatus = meta.deliveryStatus || "N/A";
        const recipientOrChannel = meta.channel
          ? (meta.recipient ? `${meta.channel}: ${meta.recipient}` : meta.channel)
          : (meta.recipient || "N/A");

        commRows.push(
          [
            sanitizeCsvValue(refCode),
            sanitizeCsvValue(enquiryDateStr),
            sanitizeCsvValue(item.fullname),
            sanitizeCsvValue(item.email),
            sanitizeCsvValue(item.company),
            sanitizeCsvValue(regionLabel),
            sanitizeCsvValue(workflowStatus),
            sanitizeCsvValue(comm.id),
            sanitizeCsvValue(commDateStr),
            sanitizeCsvValue(comm.type),
            sanitizeCsvValue(authorStr),
            sanitizeCsvValue(comm.subject || ""),
            sanitizeCsvValue(comm.body || ""),
            sanitizeCsvValue(deliveryStatus),
            sanitizeCsvValue(recipientOrChannel),
          ].join(",")
        );
      }
    }

    const csvContent = "\uFEFF" + [commHeaders.join(","), ...commRows].join("\r\n");
    const todayStr = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="icon-communications-${todayStr}.csv"`
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(csvContent);
  }

  router.get(
    "/export-communications",
    asyncHandler(handleCommunicationsExport)
  );

  router.get(
    "/export",
    asyncHandler(async (req, res) => {
      if (req.query.type === "communications") {
        return handleCommunicationsExport(req, res);
      }

      const where = buildEnquiriesFilter(req.query);

      const items = await prismaClient.enquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          fullname: true,
          company: true,
          email: true,
          phone: true,
          type: true,
          model: true,
          region: true,
          workflowStatus: true,
          status: true,
          message: true,
          assignedTo: {
            select: { email: true },
          },
          _count: {
            select: { communications: true },
          },
          communications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      const headers = [
        "Enquiry Reference",
        "Submission Date (UTC)",
        "Customer Name",
        "Company",
        "Customer Email",
        "Phone",
        "Target Office",
        "Enquiry Subject",
        "Model / Band",
        "Workflow Status",
        "Assigned Staff",
        "Dispatch Status",
        "Total Communications Count",
        "Latest Activity Date (UTC)",
        "Customer Message",
      ];

      const rows = items.map((item) => {
        const refCode = formatEnquiryReference(item.id);
        const dateStr = item.createdAt ? new Date(item.createdAt).toISOString() : "";
        const assignee = item.assignedTo?.email || "Unassigned";
        const commCount =
          item._count?.communications ?? (item.communications ? item.communications.length : 0);
        const latestActivity = item.communications?.[0]?.createdAt
          ? new Date(item.communications[0].createdAt).toISOString()
          : item.updatedAt
          ? new Date(item.updatedAt).toISOString()
          : dateStr;

        return [
          sanitizeCsvValue(refCode),
          sanitizeCsvValue(dateStr),
          sanitizeCsvValue(item.fullname),
          sanitizeCsvValue(item.company),
          sanitizeCsvValue(item.email),
          sanitizeCsvValue(item.phone),
          sanitizeCsvValue(item.region || "Unclassified"),
          sanitizeCsvValue(item.type || "general"),
          sanitizeCsvValue(item.model || ""),
          sanitizeCsvValue(item.workflowStatus || "NEW"),
          sanitizeCsvValue(assignee),
          sanitizeCsvValue(item.status || "RECEIVED"),
          sanitizeCsvValue(commCount),
          sanitizeCsvValue(latestActivity),
          sanitizeCsvValue(item.message || ""),
        ].join(",");
      });

      // UTF-8 BOM (\uFEFF) ensures Excel renders international text accurately
      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

      const todayStr = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="icon-enquiries-${todayStr}.csv"`
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(csvContent);
    })
  );

  // ── 4. GET / ──────────────────────────────────────────────────────────────
  // Paginated and filtered enquiries listing
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const where = buildEnquiriesFilter(req.query);

      const [total, items] = await Promise.all([
        prismaClient.enquiry.count({ where }),
        prismaClient.enquiry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fullname: true,
            company: true,
            email: true,
            phone: true,
            type: true,
            model: true,
            region: true,
            workflowStatus: true,
            status: true,
            emailError: true,
            createdAt: true,
            updatedAt: true,
            assignedToId: true,
            assignedTo: {
              select: {
                id: true,
                email: true,
              },
            },
            _count: {
              select: { communications: true },
            },
          },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
      });
    })
  );

  // ── 5. GET /:id ───────────────────────────────────────────────────────────
  // Single enquiry detail with chronological communication timeline
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const enquiry = await prismaClient.enquiry.findUnique({
        where: { id: req.params.id },
        include: {
          assignedTo: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          communications: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: { enquiry },
      });
    })
  );

  // ── 6. PATCH /:id/status ──────────────────────────────────────────────────
  // Transition workflow status with transaction and STATUS_CHANGE audit entry
  router.patch(
    "/:id/status",
    asyncHandler(async (req, res) => {
      const { workflowStatus, note, expectedUpdatedAt } = req.body || {};
      const targetStatus =
        typeof workflowStatus === "string" ? workflowStatus.trim().toUpperCase() : null;

      if (!ALLOWED_WORKFLOW_STATUSES.has(targetStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid workflowStatus. Must be one of: ${[...ALLOWED_WORKFLOW_STATUSES].join(", ")}.`,
        });
      }

      const adminUser = req.adminUser;
      const refCode = formatEnquiryReference(req.params.id);

      const result = await runInTransaction(prismaClient, async (tx) => {
        const existing = await tx.enquiry.findUnique({
          where: { id: req.params.id },
        });

        if (!existing) {
          return null;
        }

        // Optimistic concurrency check
        if (expectedUpdatedAt) {
          const expectedTime = new Date(expectedUpdatedAt).getTime();
          const actualTime = new Date(existing.updatedAt).getTime();
          if (!isNaN(expectedTime) && !isNaN(actualTime) && expectedTime !== actualTime) {
            return {
              conflict: true,
              message: "This enquiry was modified by another user. Please refresh and try again.",
              currentUpdatedAt: existing.updatedAt,
            };
          }
        }

        const oldStatus = existing.workflowStatus;
        if (oldStatus === targetStatus && !note) {
          return { enquiry: existing, unchanged: true };
        }

        const updatedEnquiry = await tx.enquiry.update({
          where: { id: req.params.id },
          data: { workflowStatus: targetStatus },
          include: {
            assignedTo: {
              select: { id: true, email: true },
            },
          },
        });

        const statusNote = note && typeof note === "string" ? note.trim() : null;
        const bodyText = statusNote
          ? `Status changed from ${oldStatus} to ${targetStatus}. Note: ${statusNote}`
          : `Status changed from ${oldStatus} to ${targetStatus} by ${adminUser.email}.`;

        await tx.enquiryCommunication.create({
          data: {
            enquiryId: existing.id,
            type: "STATUS_CHANGE",
            subject: `Status changed: ${oldStatus} → ${targetStatus} [Ref: #${refCode}]`,
            body: bodyText,
            metadata: {
              previousStatus: oldStatus,
              newStatus: targetStatus,
              changedBy: adminUser.email,
              userNote: statusNote,
            },
            authorId: adminUser.id,
          },
        });

        return { enquiry: updatedEnquiry, unchanged: false };
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found.",
        });
      }

      if (result.conflict) {
        return res.status(409).json({
          success: false,
          code: "CONCURRENT_MODIFICATION",
          message: result.message,
          currentUpdatedAt: result.currentUpdatedAt,
        });
      }

      return res.status(200).json({
        success: true,
        data: { enquiry: result.enquiry },
      });
    })
  );

  // ── 7. PATCH /:id/assign ──────────────────────────────────────────────────
  // Assign/reassign enquiry to staff with transaction and audit record
  // Automatically advances NEW to ASSIGNED upon assignment
  router.patch(
    "/:id/assign",
    asyncHandler(async (req, res) => {
      const { assignedToId, note, expectedUpdatedAt } = req.body || {};
      const targetUserId =
        typeof assignedToId === "string" && assignedToId.trim() ? assignedToId.trim() : null;

      // Validate target user if non-null
      let targetUser = null;
      if (targetUserId) {
        targetUser = await prismaClient.adminUser.findUnique({
          where: { id: targetUserId },
          select: { id: true, email: true, active: true },
        });

        if (!targetUser || !targetUser.active) {
          return res.status(400).json({
            success: false,
            message: "Target staff user does not exist or is inactive.",
          });
        }
      }

      const adminUser = req.adminUser;
      const refCode = formatEnquiryReference(req.params.id);

      const result = await runInTransaction(prismaClient, async (tx) => {
        const existing = await tx.enquiry.findUnique({
          where: { id: req.params.id },
          include: {
            assignedTo: { select: { id: true, email: true } },
          },
        });

        if (!existing) {
          return null;
        }

        // Optimistic concurrency check
        if (expectedUpdatedAt) {
          const expectedTime = new Date(expectedUpdatedAt).getTime();
          const actualTime = new Date(existing.updatedAt).getTime();
          if (!isNaN(expectedTime) && !isNaN(actualTime) && expectedTime !== actualTime) {
            return {
              conflict: true,
              message: "This enquiry was modified by another user. Please refresh and try again.",
              currentUpdatedAt: existing.updatedAt,
            };
          }
        }

        const previousAssigneeEmail = existing.assignedTo?.email || "Unassigned";
        const newAssigneeEmail = targetUser?.email || "Unassigned";

        // Automatic status transition: If currently NEW and being assigned to someone, advance to ASSIGNED
        let nextWorkflowStatus = existing.workflowStatus;
        let autoTransitioned = false;
        if (targetUserId && existing.workflowStatus === "NEW") {
          nextWorkflowStatus = "ASSIGNED";
          autoTransitioned = true;
        }

        const updatedEnquiry = await tx.enquiry.update({
          where: { id: req.params.id },
          data: {
            assignedToId: targetUserId,
            workflowStatus: nextWorkflowStatus,
          },
          include: {
            assignedTo: { select: { id: true, email: true } },
          },
        });

        const assignNote = note && typeof note === "string" ? note.trim() : null;
        const transitionNotice = autoTransitioned ? " (workflow status auto-advanced from NEW to ASSIGNED)" : "";
        const bodyText = assignNote
          ? `Assignment updated from ${previousAssigneeEmail} to ${newAssigneeEmail}${transitionNotice}. Note: ${assignNote}`
          : `Assignment updated from ${previousAssigneeEmail} to ${newAssigneeEmail}${transitionNotice} by ${adminUser.email}.`;

        await tx.enquiryCommunication.create({
          data: {
            enquiryId: existing.id,
            type: "STATUS_CHANGE",
            subject: `Assignment updated: ${previousAssigneeEmail} → ${newAssigneeEmail} [Ref: #${refCode}]`,
            body: bodyText,
            metadata: {
              previousAssigneeId: existing.assignedToId,
              previousAssigneeEmail,
              newAssigneeId: targetUserId,
              newAssigneeEmail,
              autoTransitioned,
              userNote: assignNote,
              changedBy: adminUser.email,
            },
            authorId: adminUser.id,
          },
        });

        return { enquiry: updatedEnquiry };
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found.",
        });
      }

      if (result.conflict) {
        return res.status(409).json({
          success: false,
          code: "CONCURRENT_MODIFICATION",
          message: result.message,
          currentUpdatedAt: result.currentUpdatedAt,
        });
      }

      return res.status(200).json({
        success: true,
        data: { enquiry: result.enquiry },
      });
    })
  );

  // ── 8. POST /:id/communications ───────────────────────────────────────────
  // Manually log CUSTOMER_REPLY, PHONE_LOG, or INTERNAL_NOTE
  router.post(
    "/:id/communications",
    asyncHandler(async (req, res) => {
      const { type, subject, body, metadata } = req.body || {};
      const commType = typeof type === "string" ? type.trim().toUpperCase() : null;

      if (!ALLOWED_MANUAL_COMM_TYPES.has(commType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid communication type. Must be one of: ${[...ALLOWED_MANUAL_COMM_TYPES].join(", ")}.`,
        });
      }

      const bodyText = typeof body === "string" ? body.trim() : "";
      if (!bodyText || bodyText.length > 4000) {
        return res.status(400).json({
          success: false,
          message: "Communication body is required and must be between 1 and 4000 characters.",
        });
      }

      const subjectText =
        typeof subject === "string" && subject.trim()
          ? subject.trim().slice(0, 200)
          : `${commType.replace(/_/g, " ")} log`;

      const safeMetadata =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
          ? metadata
          : null;

      const adminUser = req.adminUser;

      const enquiry = await prismaClient.enquiry.findUnique({
        where: { id: req.params.id },
      });

      if (!enquiry) {
        return res.status(404).json({
          success: false,
          message: "Enquiry not found.",
        });
      }

      const communication = await prismaClient.enquiryCommunication.create({
        data: {
          enquiryId: enquiry.id,
          type: commType,
          subject: subjectText,
          body: bodyText,
          metadata: safeMetadata,
          authorId: adminUser.id,
        },
        include: {
          author: {
            select: { id: true, email: true },
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: { communication },
      });
    })
  );

  return router;
}

export default createAdminEnquiriesRouter();
