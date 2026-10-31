import { Router } from "express";
import prisma from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  ApiError,
  asyncHandler,
  reorderRecords,
  validateBody,
  validateId,
  validateQuery,
  validateReorderBody,
} from "./common.js";

const router = Router();
const publicFields = {
  id: true,
  oemId: true,
  name: true,
  visible: true,
  sortOrder: true,
  sourceData: true,
  createdAt: true,
  updatedAt: true,
};
const mutableRules = {
  oemId: "nonEmptyString",
  name: "nonEmptyString",
  visible: "boolean",
  sortOrder: "sortOrder",
  sourceData: "jsonObject",
};

function publicRecord(record) {
  const sourceData =
    record.sourceData && typeof record.sourceData === "object"
      ? record.sourceData
      : {};

  return {
    id: record.id,
    oemId: record.oemId,
    name: record.name,
    visible: record.visible,
    sortOrder: record.sortOrder,
    description: sourceData.description || "",
    label: sourceData.label || "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parentFilter = validateQuery(req, res, ["oemId"], "oemId");
    if (!parentFilter) {
      return;
    }

    const data = await prisma.category.findMany({
      where: parentFilter,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parentFilter = validateQuery(req, res, ["oemId"], "oemId");
    if (!parentFilter) {
      return;
    }

    const data = await prisma.category.findMany({
      where: { ...parentFilter, visible: true, oem: { visible: true } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: publicFields,
    });

    res.status(200).json({ success: true, data: data.map(publicRecord) });
  })
);

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = validateBody(req, res, {
      allowed: ["id", ...Object.keys(mutableRules)],
      required: ["id", "oemId", "name"],
      rules: { id: "nonEmptyString", ...mutableRules },
    });
    if (!data) {
      return;
    }

    const record = await prisma.$transaction(async (transaction) => {
      const parent = await transaction.oem.findUnique({
        where: { id: data.oemId },
        select: { id: true },
      });
      if (!parent) {
        throw new ApiError(400, "Referenced OEM does not exist.");
      }
      return transaction.category.create({ data });
    });

    res.status(201).json({ success: true, data: record });
  })
);

router.patch(
  "/reorder",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const reorder = validateReorderBody(req, res, null);
    if (!reorder) {
      return;
    }

    const updatedCount = await reorderRecords(
      prisma,
      "category",
      reorder.items,
      "oemId"
    );
    res.status(200).json({ success: true, data: { updatedCount } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const parentFilter = validateQuery(req, res, [], null);
    if (!parentFilter) {
      return;
    }

    const id = validateId(req, res);
    if (!id) {
      return;
    }

    const data = await prisma.category.findFirst({
      where: { id, visible: true, oem: { visible: true } },
      select: publicFields,
    });
    if (!data) {
      throw new ApiError(404, "Category not found.");
    }

    res.status(200).json({ success: true, data: publicRecord(data) });
  })
);

router.patch(
  "/:id/visibility",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = validateId(req, res);
    if (!id) {
      return;
    }

    const data = validateBody(req, res, {
      allowed: ["visible"],
      required: ["visible"],
      rules: { visible: "boolean" },
    });
    if (!data) {
      return;
    }

    const record = await prisma.category.update({ where: { id }, data });
    res.status(200).json({ success: true, data: record });
  })
);

router.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = validateId(req, res);
    if (!id) {
      return;
    }

    const data = validateBody(req, res, {
      allowed: Object.keys(mutableRules),
      rules: mutableRules,
    });
    if (!data) {
      return;
    }
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "At least one update field is required.");
    }

    const record = await prisma.$transaction(async (transaction) => {
      if (data.oemId) {
        const parent = await transaction.oem.findUnique({
          where: { id: data.oemId },
          select: { id: true },
        });
        if (!parent) {
          throw new ApiError(400, "Referenced OEM does not exist.");
        }
      }
      return transaction.category.update({ where: { id }, data });
    });

    res.status(200).json({ success: true, data: record });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = validateId(req, res);
    if (!id) {
      return;
    }

    await prisma.category.delete({ where: { id } });
    res.status(200).json({ success: true, data: { id } });
  })
);

export default router;
