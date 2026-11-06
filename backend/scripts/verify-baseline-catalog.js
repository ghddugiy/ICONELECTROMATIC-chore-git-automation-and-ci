/**
 * verify-baseline-catalog.js
 *
 * Inspects and validates the baseline catalog data in the target database.
 *
 * Safety features:
 * 1. Executes verifyDatabaseSafety() before touching the database.
 * 2. Checks OEM, Category, Product, ImportRun, and ImportItem counts.
 * 3. Checks relational integrity (orphaned categories or products).
 * 4. Categorizes database state into:
 *    - State A: CLEAN_EMPTY (counts are 0) -> can seed baseline via catalog transfer
 *    - State B: CONSISTENT_BASELINE (all counts match baseline, 0 orphans) -> PASS, safe to skip seeding
 *    - State C: INCONSISTENT_PARTIAL -> HALTS immediately, outputs diagnostic report, never overwrites or deletes
 */

import { PrismaClient } from '@prisma/client';
import { verifyDatabaseSafety } from './verify-db-target.js';
import { normalizeCatalog, validateHierarchy, computeFingerprint, analyzeTransfer } from '../src/routes/transfer.js';
import { CATALOG } from '../../src/data/catalogData.js';

export async function inspectBaselineCatalog(prismaClient) {
  const [oemCount, catCount, prodCount, importRunCount, importItemCount] = await Promise.all([
    prismaClient.oem.count(),
    prismaClient.category.count(),
    prismaClient.product.count(),
    prismaClient.importRun.count(),
    prismaClient.importItem.count(),
  ]);

  // Check orphaned categories (categories whose oemId does not match an existing OEM)
  const existingOemIds = new Set((await prismaClient.oem.findMany({ select: { id: true } })).map((o) => o.id));
  const allCategories = await prismaClient.category.findMany({ select: { id: true, oemId: true, name: true } });
  const orphanedCategories = allCategories.filter((c) => !existingOemIds.has(c.oemId));

  // Check orphaned products (products whose categoryId does not match an existing Category)
  const existingCatIds = new Set(allCategories.map((c) => c.id));
  const allProducts = await prismaClient.product.findMany({ select: { id: true, categoryId: true, name: true } });
  const orphanedProducts = allProducts.filter((p) => !existingCatIds.has(p.categoryId));

  const counts = {
    oems: oemCount,
    categories: catCount,
    products: prodCount,
    importRuns: importRunCount,
    importItems: importItemCount,
  };

  const integrity = {
    orphanedCategoriesCount: orphanedCategories.length,
    orphanedProductsCount: orphanedProducts.length,
    orphanedCategories,
    orphanedProducts,
  };

  // State A: Clean Empty
  if (oemCount === 0 && catCount === 0 && prodCount === 0 && importRunCount === 0 && importItemCount === 0) {
    return {
      state: 'CLEAN_EMPTY',
      counts,
      integrity,
      message: 'Database is clean and empty. Ready for baseline catalog transfer.',
    };
  }

  // State B: Complete & Consistent Baseline
  const hasExpectedCounts =
    oemCount >= 15 &&
    catCount >= 88 &&
    prodCount >= 169 &&
    importRunCount >= 1 &&
    importItemCount >= 272;

  const hasZeroOrphans = orphanedCategories.length === 0 && orphanedProducts.length === 0;

  if (hasExpectedCounts && hasZeroOrphans) {
    return {
      state: 'CONSISTENT_BASELINE',
      counts,
      integrity,
      message: 'Database contains complete and consistent baseline catalog data.',
    };
  }

  // State C: Inconsistent or Partial Data
  return {
    state: 'INCONSISTENT_PARTIAL',
    counts,
    integrity,
    discrepancies: [
      oemCount < 15 ? `OEM count is ${oemCount} (expected >= 15)` : null,
      catCount < 88 ? `Category count is ${catCount} (expected >= 88)` : null,
      prodCount < 169 ? `Product count is ${prodCount} (expected >= 169)` : null,
      importRunCount < 1 ? `ImportRun count is ${importRunCount} (expected >= 1)` : null,
      importItemCount < 272 ? `ImportItem count is ${importItemCount} (expected >= 272)` : null,
      orphanedCategories.length > 0 ? `${orphanedCategories.length} orphaned categories found` : null,
      orphanedProducts.length > 0 ? `${orphanedProducts.length} orphaned products found` : null,
    ].filter(Boolean),
    message: 'Database contains partial or inconsistent data. Halting execution to prevent data corruption.',
  };
}

/**
 * Executes idempotent catalog baseline seeding.
 * Only allowed when database state is CLEAN_EMPTY.
 */
export async function seedBaselineCatalog(prismaClient) {
  const inspection = await inspectBaselineCatalog(prismaClient);

  if (inspection.state === 'CONSISTENT_BASELINE') {
    return {
      status: 'ALREADY_APPLIED',
      message: 'Baseline catalog is already present and fully consistent. No changes made.',
      counts: inspection.counts,
    };
  }

  if (inspection.state === 'INCONSISTENT_PARTIAL') {
    throw new Error(
      `Cannot seed database in INCONSISTENT_PARTIAL state. Discrepancies:\n  - ${inspection.discrepancies.join('\n  - ')}`
    );
  }

  // Database is CLEAN_EMPTY, proceed with verified atomic transfer
  const normalized = normalizeCatalog(CATALOG);
  const hierarchy = validateHierarchy(normalized.oems, normalized.categories, normalized.products);
  if (!hierarchy.valid) {
    throw new Error('Candidate catalog hierarchy is invalid.');
  }

  const analysis = await analyzeTransfer(prismaClient, normalized);
  if (analysis.conflicts.length > 0) {
    throw new Error(`Transfer conflict detected: ${analysis.conflicts.length} conflicting records.`);
  }

  const fingerprint = computeFingerprint(normalized);

  const result = await prismaClient.$transaction(async (tx) => {
    const importRun = await tx.importRun.create({
      data: {
        type: 'BASELINE_CMS',
        status: 'APPLYING',
        sourceFingerprint: fingerprint,
        summary: {
          proposedInserts: {
            oems: analysis.inserts.oems.length,
            categories: analysis.inserts.categories.length,
            products: analysis.inserts.products.length,
          },
        },
      },
    });

    for (const oem of analysis.inserts.oems) {
      await tx.oem.create({ data: oem });
      await tx.importItem.create({
        data: {
          importRunId: importRun.id,
          sourceKey: `oem:${oem.id}`,
          cmsEntityType: 'OEM',
          cmsEntityId: oem.id,
          classification: 'BASELINE_RECORD',
          decisionStatus: 'APPLIED',
          proposedData: oem,
        },
      });
    }

    for (const cat of analysis.inserts.categories) {
      await tx.category.create({ data: cat });
      await tx.importItem.create({
        data: {
          importRunId: importRun.id,
          sourceKey: `category:${cat.id}`,
          cmsEntityType: 'CATEGORY',
          cmsEntityId: cat.id,
          classification: 'BASELINE_RECORD',
          decisionStatus: 'APPLIED',
          proposedData: cat,
        },
      });
    }

    for (const prod of analysis.inserts.products) {
      await tx.product.create({ data: prod });
      await tx.importItem.create({
        data: {
          importRunId: importRun.id,
          sourceKey: `product:${prod.id}`,
          cmsEntityType: 'PRODUCT',
          cmsEntityId: prod.id,
          classification: 'BASELINE_RECORD',
          decisionStatus: 'APPLIED',
          proposedData: prod,
        },
      });
    }

    const summary = {
      importRunId: importRun.id,
      status: 'APPLIED',
      transferred: {
        oems: analysis.inserts.oems.length,
        categories: analysis.inserts.categories.length,
        products: analysis.inserts.products.length,
        total: analysis.inserts.oems.length + analysis.inserts.categories.length + analysis.inserts.products.length,
      },
      completedAt: new Date().toISOString(),
    };

    await tx.importRun.update({
      where: { id: importRun.id },
      data: { status: 'APPLIED', summary },
    });

    return summary;
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  return {
    status: 'APPLIED',
    message: 'Baseline catalog successfully transferred.',
    summary: result,
  };
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('verify-baseline-catalog.js')) {
  const args = process.argv.slice(2);

  // 1. Reject unsupported CLI flags
  const unsupportedFlags = args.filter((arg) => arg.startsWith('--') && arg !== '--seed');
  if (unsupportedFlags.length > 0) {
    console.error(`[CATALOG-INSPECT: ERROR] Unsupported CLI flag(s): ${unsupportedFlags.join(', ')}. Only '--seed' is supported.`);
    process.exit(1);
  }

  // 2. Reject unexpected positional arguments
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
  if (positionalArgs.length > 1) {
    console.error(`[CATALOG-INSPECT: ERROR] Unexpected positional arguments: ${positionalArgs.slice(1).join(', ')}. Only [database_name] is accepted.`);
    process.exit(1);
  }

  // 3. Strictly reject any database other than icon_electromatic_test
  if (positionalArgs.length === 1 && positionalArgs[0] !== 'icon_electromatic_test') {
    console.error(`[CATALOG-INSPECT: ERROR] SAFETY VIOLATION: Disallowed database "${positionalArgs[0]}". Strictly permits only "icon_electromatic_test".`);
    process.exit(1);
  }

  const shouldSeed = args.includes('--seed');
  const expectedDb = 'icon_electromatic_test';
  const expectedPort = 5433; // Explicitly enforced for Docker test database

  try {
    // 1. Strict safety check
    verifyDatabaseSafety({ expectedDbName: expectedDb, expectedPort });

    const targetUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    const prisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });

    try {
      console.log(`[CATALOG-INSPECT] Inspecting database "${expectedDb}"...`);
      const inspection = await inspectBaselineCatalog(prisma);

      console.log(`[CATALOG-INSPECT: STATE] ${inspection.state}`);
      console.log('  Counts:', JSON.stringify(inspection.counts));
      console.log('  Integrity:', JSON.stringify({
        orphanedCategories: inspection.integrity.orphanedCategoriesCount,
        orphanedProducts: inspection.integrity.orphanedProductsCount,
      }));

      if (inspection.state === 'CONSISTENT_BASELINE') {
        console.log('[CATALOG-INSPECT: PASS] Baseline catalog is complete and consistent.');
        process.exit(0);
      }

      if (inspection.state === 'INCONSISTENT_PARTIAL') {
        console.error('[CATALOG-INSPECT: FAILED] Database has partial/inconsistent catalog data:');
        inspection.discrepancies.forEach((d) => console.error(`  - ${d}`));
        process.exit(1);
      }

      if (inspection.state === 'CLEAN_EMPTY') {
        if (shouldSeed) {
          console.log('[CATALOG-INSPECT] Database is empty. Seeding baseline catalog...');
          const seedRes = await seedBaselineCatalog(prisma);
          console.log(`[CATALOG-INSPECT: SEED] Status: ${seedRes.status}`);
          console.log('[CATALOG-INSPECT: PASS] Baseline catalog seeded successfully.');
          process.exit(0);
        } else {
          console.log('[CATALOG-INSPECT: NOTICE] Database is clean and empty. Pass --seed to apply baseline transfer.');
          process.exit(0);
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    console.error(`[CATALOG-INSPECT: ERROR] ${err.message}`);
    process.exit(1);
  }
}
