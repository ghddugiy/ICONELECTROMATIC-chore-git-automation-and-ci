import test from "node:test";
import assert from "node:assert/strict";
import {
  getNonInteractiveCredentials,
  runProvisionAdmin,
} from "../scripts/provision-admin.js";
import { verifyPassword } from "../src/auth/security.js";

test("non-interactive provisioning validates environment credentials", () => {
  assert.deepEqual(
    getNonInteractiveCredentials({
      ADMIN_EMAIL: "  ADMIN@example.com ",
      ADMIN_PASSWORD: "a-secure-password",
    }),
    {
      email: "admin@example.com",
      password: "a-secure-password",
    }
  );
});

test("non-interactive provisioning fails safely when required environment is missing", async () => {
  let prismaCreated = false;
  const errors = [];
  const secret = "a-secret-password";

  const succeeded = await runProvisionAdmin({
    args: ["--non-interactive"],
    env: { ADMIN_PASSWORD: secret },
    output: { write() {} },
    errorOutput: { write: (message) => errors.push(message) },
    createPrismaClient: () => {
      prismaCreated = true;
      throw new Error("Should not connect");
    },
  });

  assert.equal(succeeded, false);
  assert.equal(prismaCreated, false);
  assert.ok(errors.join("").length > 0);
  assert.ok(!errors.join("").includes(secret));
});

test("non-interactive provisioning stores a password hash without printing the secret", async () => {
  const secret = "a-secure-password";
  const messages = [];
  let createArgs;
  let disconnected = false;

  const succeeded = await runProvisionAdmin({
    args: ["--non-interactive"],
    env: {
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: secret,
    },
    output: { write: (message) => messages.push(message) },
    errorOutput: { write: (message) => messages.push(message) },
    createPrismaClient: () => ({
      adminUser: {
        create: async (args) => {
          createArgs = args;
          return { id: "admin-id" };
        },
      },
      $disconnect: async () => {
        disconnected = true;
      },
    }),
  });

  assert.equal(succeeded, true);
  assert.equal(disconnected, true);
  assert.equal(createArgs.data.email, "admin@example.com");
  assert.notEqual(createArgs.data.passwordHash, secret);
  assert.equal(
    await verifyPassword(secret, createArgs.data.passwordHash),
    true
  );
  assert.ok(!messages.join("").includes(secret));
});
