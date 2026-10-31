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
  name: true,
  websiteUrl: true,
  visible: true,
  sortOrder: true,
  sourceData: true,
  createdAt: true,
  updatedAt: true,
};
const mutableRules = {
  name: "nonEmptyString",
  websiteUrl: "httpUrlOrNull",
  visible: "boolean",
  sortOrder: "sortOrder",
  sourceData: "jsonObject",
};

function publicRecord(record) {
  const sourceData =
    record.sourceData && typeof record.sourceData === "object"
      ? record.sourceData
      : {};
  const {
    shortName,
    specialty,
    category,
    tagline,
    description,
    logoImg,
    logoSvg,
    defaultImage,
    accentColor,
    glowColor,
    website,
  } = sourceData;

  return {
    id: record.id,
    name: record.name,
    websiteUrl: record.websiteUrl,
    website: website || record.websiteUrl,
    visible: record.visible,
    sortOrder: record.sortOrder,
    shortName,
    specialty,
    category,
    tagline,
    description,
    logoImg,
    logoSvg,
    defaultImage,
    accentColor,
    glowColor,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

router.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const data = await prisma.oem.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { ...publicFields, sourceData: true },
    });

    res.status(200).json({ success: true, data });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!validateQuery(req, res, [])) {
      return;
    }

    const data = await prisma.oem.findMany({
      where: { visible: true },
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
      required: ["id", "name"],
      rules: { id: "nonEmptyString", ...mutableRules },
    });
    if (!data) {
      return;
    }

    const record = await prisma.oem.create({ data });
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
      "oem",
      reorder.items,
      null
    );
    res.status(200).json({ success: true, data: { updatedCount } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!validateQuery(req, res, [])) {
      return;
    }

    const id = validateId(req, res);
    if (!id) {
      return;
    }

    const data = await prisma.oem.findFirst({
      where: { id, visible: true },
      select: publicFields,
    });
    if (!data) {
      throw new ApiError(404, "OEM not found.");
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

    const record = await prisma.oem.update({ where: { id }, data });
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

    const record = await prisma.oem.update({ where: { id }, data });
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

    await prisma.oem.delete({ where: { id } });
    res.status(200).json({ success: true, data: { id } });
  })
);

export default router;
