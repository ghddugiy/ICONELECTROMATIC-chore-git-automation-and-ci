/**
 * seed-ci-catalog.js
 *
 * Seeds the ephemeral GitHub Actions CI PostgreSQL database with the baseline
 * catalog (15 OEMs, 88 categories, 169 products) sourced from catalogData.js.
 *
 * Safety constraints (enforced before any database operation):
 *   1. DATABASE_URL must be present.
 *   2. Host must be localhost or 127.0.0.1 — refuses all remote hosts.
 *   3. Database name must be exactly "icon_ci_test" — refuses all other names,
 *      including the developer database (icon_electromatic) and any production DB.
 *   4. Never reads or modifies .env; uses only the DATABASE_URL env var.
 *
 * Uses the existing seedBaselineCatalog() which is idempotent: if the catalog
 * is already present it exits cleanly without touching the database.
 */

import { PrismaClient } from "@prisma/client";
import { seedBaselineCatalog } from "./verify-baseline-catalog.js";

const REQUIRED_DB_NAME = "icon_ci_test";
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1"]);

function validateCIDatabase(urlString) {
  if (!urlString) {
    throw new Error(
      "DATABASE_URL is not set. This script requires an explicit CI database URL."
    );
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  const host = (parsed.hostname || "").toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `SAFETY VIOLATION: Host "${host}" is not local. Refusing to seed a remote database.`
    );
  }

  // Strip leading slash from pathname to get the database name.
  const dbName = (parsed.pathname || "").replace(/^\//, "").split("?")[0];
  if (dbName !== REQUIRED_DB_NAME) {
    throw new Error(
      `SAFETY VIOLATION: Database name "${dbName}" is not the CI test database ` +
        `("${REQUIRED_DB_NAME}"). Refusing to seed.`
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL;

  // Fail fast with a clear message before connecting.
  validateCIDatabase(url);

  console.log("[CI-SEED] Safety check passed. Connecting to CI database…");

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const result = await seedBaselineCatalog(prisma);

    if (result.status === "ALREADY_APPLIED") {
      console.log("[CI-SEED] Catalog already present — no changes made.");
      console.log(`[CI-SEED] Counts: ${JSON.stringify(result.counts)}`);
    } else {
      console.log("[CI-SEED] Baseline catalog seeded successfully.");
      console.log(`[CI-SEED] Transferred: ${JSON.stringify(result.summary?.transferred)}`);
    }

    console.log("[CI-SEED] Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[CI-SEED: ERROR] ${err.message}`);
  process.exit(1);
});
