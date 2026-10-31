import { Router } from "express";
import { createHash } from "node:crypto";
import prisma from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import { ApiError, asyncHandler } from "./common.js";
import { CATALOG } from "../../../src/data/catalogData.js";

function isValidHttpUrl(string) {
  if (!string || typeof string !== "string") return false;
  try {
    const url = new URL(string.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function normalizeCatalog(rawCatalog = CATALOG) {
  const oems = [];
  const categories = [];
  const products = [];
  const duplicateOemIds = new Set();
  const duplicateCategoryIds = new Set();
  const duplicateProductIds = new Set();
  const seenOemIds = new Set();
  const seenCategoryIds = new Set();
  const seenProductIds = new Set();
  const urlSanitizationItems = [];

  const catalog = Array.isArray(rawCatalog) && rawCatalog.length > 0 ? rawCatalog : CATALOG;

  catalog.forEach((rawOem, oemIndex) => {
    if (seenOemIds.has(rawOem.id)) {
      duplicateOemIds.add(rawOem.id);
    }
    seenOemIds.add(rawOem.id);

    const rawWebsite = typeof rawOem.website === "string" ? rawOem.website.trim() : null;
    const validWebsite = rawWebsite && isValidHttpUrl(rawWebsite) ? rawWebsite : null;
    if (rawWebsite && !validWebsite) {
      urlSanitizationItems.push({
        type: "OEM",
        id: rawOem.id,
        name: rawOem.name,
        rawLink: rawWebsite,
        field: "websiteUrl",
        reason: "Non-HTTP(S) string preserved in sourceData.website while websiteUrl remains null.",
      });
    }

    const { categories: rawCats, id: _oemId, name, visible, website: _web, sortOrder, ...extraOem } = rawOem;
    const normalizedOem = {
      id: rawOem.id,
      name: rawOem.name,
      websiteUrl: validWebsite,
      visible: visible !== false,
      sortOrder: typeof sortOrder === "number" && Number.isInteger(sortOrder) ? sortOrder : oemIndex,
      sourceData: {
        ...extraOem,
        ...(rawWebsite && !validWebsite ? { website: rawWebsite } : {}),
      },
    };
    oems.push(normalizedOem);

    (rawCats || []).forEach((rawCat, catIndex) => {
      if (seenCategoryIds.has(rawCat.id)) {
        duplicateCategoryIds.add(rawCat.id);
      }
      seenCategoryIds.add(rawCat.id);

      const { products: rawProds, id: _catId, oemId: _catOemId, name: catName, visible: catVis, sortOrder: catOrder, ...extraCat } = rawCat;
      const normalizedCat = {
        id: rawCat.id,
        oemId: rawOem.id,
        name: rawCat.name,
        visible: catVis !== false,
        sortOrder: typeof catOrder === "number" && Number.isInteger(catOrder) ? catOrder : catIndex,
        sourceData: extraCat,
      };
      categories.push(normalizedCat);

      (rawProds || []).forEach((rawProd, prodIndex) => {
        if (seenProductIds.has(rawProd.id)) {
          duplicateProductIds.add(rawProd.id);
        }
        seenProductIds.add(rawProd.id);

        const rawLink = typeof rawProd.link === "string" ? rawProd.link.trim() : null;
        const validLink = rawLink && isValidHttpUrl(rawLink) ? rawLink : null;
        if (rawLink && !validLink) {
          urlSanitizationItems.push({
            type: "Product",
            id: rawProd.id,
            name: rawProd.name,
            rawLink: rawLink,
            field: "externalLink",
            reason: "Non-HTTP(S) string preserved in sourceData.link while externalLink remains null.",
          });
        }

        const { id: _pId, categoryId: _pCatId, name: pName, description, applications, link: _pLink, image, visible: pVis, sortOrder: pOrder, ...extraProd } = rawProd;
        const normalizedProd = {
          id: rawProd.id,
          categoryId: rawCat.id,
          name: rawProd.name,
          description: description || null,
          applications: applications || null,
          externalLink: validLink,
          visible: pVis !== false,
          sortOrder: typeof pOrder === "number" && Number.isInteger(pOrder) ? pOrder : prodIndex,
          sourceImagePath: image || null,
          sourceData: {
            ...extraProd,
            category: rawProd.category || rawCat.name,
            ...(rawLink && !validLink ? { link: rawLink } : {}),
          },
        };
        products.push(normalizedProd);
      });
    });
  });

  return {
    oems,
    categories,
    products,
    duplicates: {
      valid: duplicateOemIds.size === 0 && duplicateCategoryIds.size === 0 && duplicateProductIds.size === 0,
      duplicateOemIds: [...duplicateOemIds],
      duplicateCategoryIds: [...duplicateCategoryIds],
      duplicateProductIds: [...duplicateProductIds],
    },
    urlSanitization: {
      flaggedCount: urlSanitizationItems.length,
      items: urlSanitizationItems,
    },
  };
}

export function validateHierarchy(oems, categories, products) {
  const oemIds = new Set(oems.map((o) => o.id));
  const categoryIds = new Set(categories.map((c) => c.id));

  const orphanedCategories = categories.filter((c) => !oemIds.has(c.oemId));
  const orphanedProducts = products.filter((p) => !categoryIds.has(p.categoryId));

  return {
    valid: orphanedCategories.length === 0 && orphanedProducts.length === 0,
    orphanedCategories: orphanedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      invalidOemId: c.oemId,
    })),
    orphanedProducts: orphanedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      invalidCategoryId: p.categoryId,
    })),
  };
}

export function computeFingerprint(normalizedData) {
  const hash = createHash("sha256");
  const payload = JSON.stringify({
    oems: normalizedData.oems.map((o) => ({ id: o.id, name: o.name, sortOrder: o.sortOrder })),
    categories: normalizedData.categories.map((c) => ({ id: c.id, oemId: c.oemId, name: c.name, sortOrder: c.sortOrder })),
    products: normalizedData.products.map((p) => ({ id: p.id, categoryId: p.categoryId, name: p.name, sortOrder: p.sortOrder })),
  });
  hash.update(payload);
  return hash.digest("hex");
}

export async function analyzeTransfer(prismaClient, normalizedData) {
  const { oems, categories, products } = normalizedData;

  const [existingOems, existingCategories, existingProducts] = await Promise.all([
    prismaClient.oem.findMany({ select: { id: true, name: true, sortOrder: true, visible: true } }),
    prismaClient.category.findMany({ select: { id: true, oemId: true, name: true, sortOrder: true, visible: true } }),
    prismaClient.product.findMany({ select: { id: true, categoryId: true, name: true, sortOrder: true, visible: true } }),
  ]);

  const oemMap = new Map(existingOems.map((o) => [o.id, o]));
  const catMap = new Map(existingCategories.map((c) => [c.id, c]));
  const prodMap = new Map(existingProducts.map((p) => [p.id, p]));

  const inserts = { oems: [], categories: [], products: [] };
  const matches = { oems: [], categories: [], products: [] };
  const conflicts = [];

  // OEMs
  for (const oem of oems) {
    const existing = oemMap.get(oem.id);
    if (!existing) {
      inserts.oems.push(oem);
    } else if (existing.name === oem.name) {
      matches.oems.push(oem);
    } else {
      conflicts.push({
        type: "OEM",
        id: oem.id,
        candidateName: oem.name,
        existingName: existing.name,
        reason: "Conflicting name for existing OEM ID",
      });
    }
  }

  // Categories
  for (const cat of categories) {
    const existing = catMap.get(cat.id);
    if (!existing) {
      inserts.categories.push(cat);
    } else if (existing.name === cat.name && existing.oemId === cat.oemId) {
      matches.categories.push(cat);
    } else {
      conflicts.push({
        type: "Category",
        id: cat.id,
        candidateName: cat.name,
        candidateParent: cat.oemId,
        existingName: existing.name,
        existingParent: existing.oemId,
        reason: "Conflicting name or OEM parent for existing Category ID",
      });
    }
  }

  // Products
  for (const prod of products) {
    const existing = prodMap.get(prod.id);
    if (!existing) {
      inserts.products.push(prod);
    } else if (existing.name === prod.name && existing.categoryId === prod.categoryId) {
      matches.products.push(prod);
    } else {
      conflicts.push({
        type: "Product",
        id: prod.id,
        candidateName: prod.name,
        candidateParent: prod.categoryId,
        existingName: existing.name,
        existingParent: existing.categoryId,
        reason: "Conflicting name or Category parent for existing Product ID",
      });
    }
  }

  return {
    existingCounts: {
      oems: existingOems.length,
      categories: existingCategories.length,
      products: existingProducts.length,
      total: existingOems.length + existingCategories.length + existingProducts.length,
    },
    inserts,
    matches,
    conflicts,
  };
}

export function createTransferRouter({
  prismaClient = prisma,
  requireAdminMiddleware = requireAdmin,
} = {}) {
  const router = Router();

  // Dry-run preview endpoint (READ-ONLY, ZERO WRITES)
  router.post(
    "/dry-run",
    requireAdminMiddleware,
    asyncHandler(async (req, res) => {
      const candidateCatalog = req.body?.catalog || CATALOG;
      const normalized = normalizeCatalog(candidateCatalog);
      const hierarchy = validateHierarchy(normalized.oems, normalized.categories, normalized.products);
      const analysis = await analyzeTransfer(prismaClient, normalized);
      const fingerprint = computeFingerprint(normalized);

      const candidateTotal =
        normalized.oems.length + normalized.categories.length + normalized.products.length;
      const insertsTotal =
        analysis.inserts.oems.length + analysis.inserts.categories.length + analysis.inserts.products.length;
      const matchesTotal =
        analysis.matches.oems.length + analysis.matches.categories.length + analysis.matches.products.length;

      const report = {
        dryRun: true,
        status: "PREVIEW_READY",
        sourceFingerprint: fingerprint,
        counts: {
          candidate: {
            oems: normalized.oems.length,
            categories: normalized.categories.length,
            products: normalized.products.length,
            total: candidateTotal,
          },
          existing: analysis.existingCounts,
          proposedInserts: {
            oems: analysis.inserts.oems.length,
            categories: analysis.inserts.categories.length,
            products: analysis.inserts.products.length,
            total: insertsTotal,
          },
          matches: {
            oems: analysis.matches.oems.length,
            categories: analysis.matches.categories.length,
            products: analysis.matches.products.length,
            total: matchesTotal,
          },
          conflicts: {
            total: analysis.conflicts.length,
          },
          skips: {
            total: matchesTotal,
          },
        },
        hierarchy,
        duplicates: normalized.duplicates,
        urlSanitization: normalized.urlSanitization,
        proposedCreates: {
          oems: analysis.inserts.oems.map((o) => ({ id: o.id, name: o.name })),
          categories: analysis.inserts.categories.map((c) => ({ id: c.id, oemId: c.oemId, name: c.name })),
          products: analysis.inserts.products.slice(0, 15).map((p) => ({ id: p.id, categoryId: p.categoryId, name: p.name })),
          productsRemainingCount: Math.max(0, analysis.inserts.products.length - 15),
        },
        conflicts: analysis.conflicts,
        safetyNotice:
          "DRY-RUN ONLY: Zero database writes performed. Live PostgreSQL database remains completely unchanged.",
      };

      res.status(200).json({ success: true, data: report });
    })
  );

  // Execution endpoint (runs within transaction with repeat-attempt safety)
  router.post(
    "/execute",
    requireAdminMiddleware,
    asyncHandler(async (req, res) => {
      const candidateCatalog = req.body?.catalog || CATALOG;
      const normalized = normalizeCatalog(candidateCatalog);

      if (!normalized.duplicates.valid) {
        throw new ApiError(400, "Validation failed: duplicate IDs detected in candidate catalog.");
      }

      const hierarchy = validateHierarchy(normalized.oems, normalized.categories, normalized.products);
      if (!hierarchy.valid) {
        throw new ApiError(400, "Validation failed: orphaned categories or products detected in hierarchy.");
      }

      const analysis = await analyzeTransfer(prismaClient, normalized);
      if (analysis.conflicts.length > 0) {
        throw new ApiError(
          409,
          `Transfer conflict: ${analysis.conflicts.length} records conflict with existing database records. Review conflict details before proceeding.`
        );
      }

      const insertsCount =
        analysis.inserts.oems.length + analysis.inserts.categories.length + analysis.inserts.products.length;

      // Safe repeat attempt: if all records already exist and match, report safe no-op
      if (insertsCount === 0) {
        return res.status(200).json({
          success: true,
          data: {
            status: "ALREADY_APPLIED",
            message: "All candidate catalog records are already present in PostgreSQL. No records modified.",
            transferred: { oems: 0, categories: 0, products: 0, total: 0 },
            skippedMatches: {
              oems: analysis.matches.oems.length,
              categories: analysis.matches.categories.length,
              products: analysis.matches.products.length,
              total: analysis.matches.oems.length + analysis.matches.categories.length + analysis.matches.products.length,
            },
          },
        });
      }

      const fingerprint = computeFingerprint(normalized);

      // Execute within an isolated transaction
      const transferSummary = await prismaClient.$transaction(async (tx) => {
        const importRun = await tx.importRun.create({
          data: {
            type: "BASELINE_CMS",
            status: "APPLYING",
            sourceFingerprint: fingerprint,
            startedById: req.adminUser?.id || null,
            summary: {
              proposedInserts: {
                oems: analysis.inserts.oems.length,
                categories: analysis.inserts.categories.length,
                products: analysis.inserts.products.length,
              },
              skippedMatches: {
                oems: analysis.matches.oems.length,
                categories: analysis.matches.categories.length,
                products: analysis.matches.products.length,
              },
            },
          },
        });

        // 1. Insert OEMs
        for (const oem of analysis.inserts.oems) {
          await tx.oem.create({ data: oem });
          await tx.importItem.create({
            data: {
              importRunId: importRun.id,
              sourceKey: `oem:${oem.id}`,
              cmsEntityType: "OEM",
              cmsEntityId: oem.id,
              classification: "BASELINE_RECORD",
              decisionStatus: "APPLIED",
              proposedData: oem,
            },
          });
        }

        // 2. Insert Categories
        for (const cat of analysis.inserts.categories) {
          await tx.category.create({ data: cat });
          await tx.importItem.create({
            data: {
              importRunId: importRun.id,
              sourceKey: `category:${cat.id}`,
              cmsEntityType: "CATEGORY",
              cmsEntityId: cat.id,
              classification: "BASELINE_RECORD",
              decisionStatus: "APPLIED",
              proposedData: cat,
            },
          });
        }

        // 3. Insert Products
        for (const prod of analysis.inserts.products) {
          await tx.product.create({ data: prod });
          await tx.importItem.create({
            data: {
              importRunId: importRun.id,
              sourceKey: `product:${prod.id}`,
              cmsEntityType: "PRODUCT",
              cmsEntityId: prod.id,
              classification: "BASELINE_RECORD",
              decisionStatus: "APPLIED",
              proposedData: prod,
            },
          });
        }

        const summary = {
          importRunId: importRun.id,
          status: "APPLIED",
          transferred: {
            oems: analysis.inserts.oems.length,
            categories: analysis.inserts.categories.length,
            products: analysis.inserts.products.length,
            total: insertsCount,
          },
          skippedMatches: {
            oems: analysis.matches.oems.length,
            categories: analysis.matches.categories.length,
            products: analysis.matches.products.length,
            total: analysis.matches.oems.length + analysis.matches.categories.length + analysis.matches.products.length,
          },
          completedAt: new Date().toISOString(),
        };

        await tx.importRun.update({
          where: { id: importRun.id },
          data: {
            status: "APPLIED",
            summary,
          },
        });

        return summary;
      });

      return res.status(200).json({ success: true, data: transferSummary });
    })
  );

  return router;
}

export default createTransferRouter();
