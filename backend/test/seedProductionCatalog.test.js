import test from "node:test";
import assert from "node:assert/strict";
import {
  runProductionCatalogSeed,
  validateProductionSeedTarget,
} from "../scripts/seed-production-catalog.js";

const productionUrl =
  "postgresql://db-user:db-password@catalog.example/icon_electromatic?sslmode=require";
const secureProductionUrl = productionUrl.replace(
  "sslmode=require",
  "sslmode=verify-full"
);
const targetConfirmation = "catalog.example:5432/icon_electromatic";

test("production seed target requires a remote TLS PostgreSQL URL and exact confirmation", () => {
  assert.deepEqual(
    validateProductionSeedTarget(secureProductionUrl, targetConfirmation),
    {
      url: secureProductionUrl,
      target: targetConfirmation,
    }
  );
  assert.throws(
    () =>
      validateProductionSeedTarget(secureProductionUrl, "other.example/database"),
    /confirmation must exactly match/
  );
  assert.throws(
    () =>
      validateProductionSeedTarget(
        "postgresql://user:password@localhost/icon_electromatic?sslmode=require",
        "localhost:5432/icon_electromatic"
      ),
    /refuses local database hosts/
  );
  assert.throws(
    () =>
      validateProductionSeedTarget(
        "postgresql://user:password@catalog.example/icon_electromatic_test?sslmode=require",
        "catalog.example:5432/icon_electromatic_test"
      ),
    /refuses test databases/
  );
  assert.throws(
    () =>
      validateProductionSeedTarget(
        "postgresql://user:password@catalog.example/icon_electromatic",
        "catalog.example:5432/icon_electromatic"
      ),
    /sslmode=verify-full/
  );
  for (const sslmode of ["require", "verify-ca"]) {
      assert.throws(
        () =>
          validateProductionSeedTarget(
            secureProductionUrl.replace("verify-full", sslmode),
            targetConfirmation
          ),
        /sslmode=verify-full/
      );
  }
});

test("production seed defaults to a read-only inspection", async () => {
  let seedCalled = false;
  const output = [];
  const errors = [];
  const succeeded = await runProductionCatalogSeed({
    env: { PRODUCTION_DATABASE_URL: secureProductionUrl },
    output: { write: (message) => output.push(message) },
    errorOutput: { write: (message) => errors.push(message) },
    createPrismaClient: () => ({ $disconnect: async () => {} }),
    inspectCatalog: async () => ({
      state: "CLEAN_EMPTY",
      counts: { oems: 0, categories: 0, products: 0 },
    }),
    seedCatalog: async () => {
      seedCalled = true;
      return { status: "APPLIED" };
    },
  });

  assert.equal(succeeded, true);
  assert.equal(seedCalled, false);
  assert.equal(errors.length, 0);
  assert.ok(output.join("").includes("Read-only inspection"));
  assert.ok(!output.join("").includes("db-password"));
});

test("production seed requires explicit target confirmation before applying", async () => {
  let prismaCreated = false;
  const errors = [];
  const succeeded = await runProductionCatalogSeed({
    args: ["--apply"],
    env: { PRODUCTION_DATABASE_URL: secureProductionUrl },
    output: { write() {} },
    errorOutput: { write: (message) => errors.push(message) },
    createPrismaClient: () => {
      prismaCreated = true;
      throw new Error("Must not connect");
    },
  });

  assert.equal(succeeded, false);
  assert.equal(prismaCreated, false);
  assert.ok(errors.length > 0);
});

test("production seed applies only an empty baseline and never replaces an inconsistent catalog", async () => {
  let seedCalls = 0;
  let disconnectCalls = 0;
  const successfulRun = await runProductionCatalogSeed({
    args: ["--apply", `--confirm-production-seed=${targetConfirmation}`],
    env: { PRODUCTION_DATABASE_URL: secureProductionUrl },
    output: { write() {} },
    errorOutput: { write() {} },
    createPrismaClient: () => ({
      $disconnect: async () => {
        disconnectCalls += 1;
      },
    }),
    inspectCatalog: async () => ({
      state: "CLEAN_EMPTY",
      counts: { oems: 0, categories: 0, products: 0 },
    }),
    seedCatalog: async () => {
      seedCalls += 1;
      return { status: "APPLIED" };
    },
  });

  assert.equal(successfulRun, true);
  assert.equal(seedCalls, 1);
  assert.equal(disconnectCalls, 1);

  const consistentRun = await runProductionCatalogSeed({
    args: ["--apply", `--confirm-production-seed=${targetConfirmation}`],
    env: { PRODUCTION_DATABASE_URL: secureProductionUrl },
    output: { write() {} },
    errorOutput: { write() {} },
    createPrismaClient: () => ({ $disconnect: async () => {} }),
    inspectCatalog: async () => ({
      state: "CONSISTENT_BASELINE",
      counts: { oems: 15, categories: 88, products: 169 },
    }),
    seedCatalog: async () => {
      seedCalls += 1;
      return { status: "ALREADY_APPLIED" };
    },
  });

  assert.equal(consistentRun, true);
  assert.equal(seedCalls, 2);

  const failedRun = await runProductionCatalogSeed({
    args: ["--apply", `--confirm-production-seed=${targetConfirmation}`],
    env: { PRODUCTION_DATABASE_URL: secureProductionUrl },
    output: { write() {} },
    errorOutput: { write() {} },
    createPrismaClient: () => ({ $disconnect: async () => {} }),
    inspectCatalog: async () => ({
      state: "INCONSISTENT_PARTIAL",
      counts: { oems: 1, categories: 0, products: 0 },
    }),
    seedCatalog: async () => {
      throw new Error("Must not seed inconsistent data");
    },
  });

  assert.equal(failedRun, false);
  assert.equal(seedCalls, 2);
});
