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
  categoryId: true,
  name: true,
  description: true,
  applications: true,
  externalLink: true,
  sourceImagePath: true,
  sourceData: true,
  visible: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
};
const mutableRules = {
  categoryId: "nonEmptyString",
  name: "nonEmptyString",
  description: "nullableString",
  applications: "nullableString",
  externalLink: "httpUrlOrNull",
  visible: "boolean",
  sortOrder: "sortOrder",
  sourceImagePath: "nullableString",
  sourceData: "jsonObject",
};

function publicRecord(record) {
  const sourceData =
    record.sourceData && typeof record.sourceData === "object"
      ? record.sourceData
      : {};

  return {
    id: record.id,
    categoryId: record.categoryId,
    name: record.name,
    description: record.description,
    applications: record.applications,
    externalLink: record.externalLink,
    image: sourceData.image || record.sourceImagePath || "",
    link: sourceData.link || record.externalLink || "",
    visible: record.visible,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parentFilter = validateQuery(
      req,
      res,
      ["categoryId"],
      "categoryId"
    );
    if (!parentFilter) {
      return;
    }

    const data = await prisma.product.findMany({
      where: parentFilter,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const parentFilter = validateQuery(
      req,
      res,
      ["categoryId"],
      "categoryId"
    );
    if (!parentFilter) {
      return;
    }

    const data = await prisma.product.findMany({
      where: {
        ...parentFilter,
        visible: true,
        category: { visible: true, oem: { visible: true } },
      },
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
      required: ["id", "categoryId", "name"],
      rules: { id: "nonEmptyString", ...mutableRules },
    });
    if (!data) {
      return;
    }

    const record = await prisma.$transaction(async (transaction) => {
      const parent = await transaction.category.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!parent) {
        throw new ApiError(400, "Referenced category does not exist.");
      }
      return transaction.product.create({ data });
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
      "product",
      reorder.items,
      "categoryId"
    );
    res.status(200).json({ success: true, data: { updatedCount } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const queryFilter = validateQuery(req, res, [], null);
    if (!queryFilter) {
      return;
    }

    const id = validateId(req, res);
    if (!id) {
      return;
    }

    const data = await prisma.product.findFirst({
      where: {
        id,
        visible: true,
        category: { visible: true, oem: { visible: true } },
      },
      select: publicFields,
    });
    if (!data) {
      throw new ApiError(404, "Product not found.");
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

    const record = await prisma.product.update({ where: { id }, data });
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
      if (data.categoryId) {
        const parent = await transaction.category.findUnique({
          where: { id: data.categoryId },
          select: { id: true },
        });
        if (!parent) {
          throw new ApiError(400, "Referenced category does not exist.");
        }
      }
      return transaction.product.update({ where: { id }, data });
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

    await prisma.product.delete({ where: { id } });
    res.status(200).json({ success: true, data: { id } });
  })
);

export default router;
