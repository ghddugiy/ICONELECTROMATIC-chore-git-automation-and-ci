import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  inspectBaselineCatalog,
  seedBaselineCatalog,
} from "./verify-baseline-catalog.js";

const CONFIRMATION_PREFIX = "--confirm-production-seed=";
const BLOCKED_DATABASES = new Set([
  "icon_electromatic_test",
  "icon_ci_test",
]);

export function validateProductionSeedTarget(
  urlString,
  confirmation,
  { requireConfirmation = true } = {}
) {
  if (typeof urlString !== "string" || !urlString.trim()) {
    throw new Error("PRODUCTION_DATABASE_URL is required.");
  }

  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("PRODUCTION_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Production catalog seeding requires a PostgreSQL URL.");
  }

  const hostname = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const port = url.port || "5432";

  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    throw new Error("Production catalog seeding refuses local database hosts.");
  }

  if (!database || BLOCKED_DATABASES.has(database.toLowerCase())) {
    throw new Error("Production catalog seeding refuses test databases.");
  }

  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(
      "Production database URL must use sslmode=verify-full to verify the server certificate and hostname."
    );
  }

  const target = `${hostname}:${port}/${database}`;
  if (requireConfirmation && confirmation !== target) {
    throw new Error(
      `Explicit target confirmation must exactly match ${target}.`
    );
  }

  return { url: urlString, target };
}

function parseArgs(args) {
  const apply = args.includes("--apply");
  const confirmationArgs = args.filter((arg) =>
    arg.startsWith(CONFIRMATION_PREFIX)
  );
  const unknownArgs = args.filter(
    (arg) => arg !== "--apply" && !arg.startsWith(CONFIRMATION_PREFIX)
  );

  if (unknownArgs.length || confirmationArgs.length > 1) {
    throw new Error("Unsupported or duplicate production seed arguments.");
  }

  return {
    apply,
    confirmation: confirmationArgs[0]?.slice(CONFIRMATION_PREFIX.length) || "",
  };
}

export async function runProductionCatalogSeed({
  args = process.argv.slice(2),
  env = process.env,
  output = process.stdout,
  errorOutput = process.stderr,
  createPrismaClient = (url) =>
    new PrismaClient({ datasources: { db: { url } } }),
  inspectCatalog = inspectBaselineCatalog,
  seedCatalog = seedBaselineCatalog,
} = {}) {
  let prismaClient;
  let succeeded = false;

  try {
    const options = parseArgs(args);
    const target = validateProductionSeedTarget(
      env.PRODUCTION_DATABASE_URL,
      options.confirmation,
      { requireConfirmation: options.apply }
    );

    prismaClient = createPrismaClient(target.url);
    const inspection = await inspectCatalog(prismaClient);
    output.write(
      `[PRODUCTION-CATALOG] Target ${target.target}: ${inspection.state}; ` +
        `counts ${JSON.stringify(inspection.counts)}.\n`
    );

    if (inspection.state === "INCONSISTENT_PARTIAL") {
      throw new Error("Catalog state is inconsistent.");
    }

    if (!options.apply) {
      output.write("[PRODUCTION-CATALOG] Read-only inspection complete; no changes made.\n");
      succeeded = true;
    } else {
      if (inspection.state !== "CLEAN_EMPTY" && inspection.state !== "CONSISTENT_BASELINE") {
        throw new Error("Catalog state is not safe to seed.");
      }

      const result = await seedCatalog(prismaClient);
      output.write(
        `[PRODUCTION-CATALOG] Seeding complete: ${result.status}.\n`
      );
      succeeded = true;
    }
  } catch {
    succeeded = false;
    errorOutput.write(
      "[PRODUCTION-CATALOG] Seeding stopped. Check the target and catalog state; existing records are never replaced.\n"
    );
    return false;
  } finally {
    if (prismaClient) {
      try {
        await prismaClient.$disconnect();
      } catch {
        succeeded = false;
        errorOutput.write("[PRODUCTION-CATALOG] Database disconnect failed.\n");
      }
    }
  }

  return succeeded;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const succeeded = await runProductionCatalogSeed();
  if (!succeeded) process.exitCode = 1;
}
