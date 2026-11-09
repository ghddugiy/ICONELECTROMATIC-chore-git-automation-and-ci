import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPasswordHash } from "../src/auth/security.js";

function ask(question, input = process.stdin, output = process.stdout) {
  const readline = createInterface({
    input,
    output,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

function askHidden(question, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY) {
    return Promise.reject(new Error("Interactive terminal required."));
  }

  return new Promise((resolve, reject) => {
    let value = "";

    function finish(error) {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }

    function onData(chunk) {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Provisioning cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          value = Array.from(value).slice(0, -1).join("");
        } else if (character >= " ") {
          value += character;
        }
      }
    }

    output.write(question);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

export function validateAdminEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Invalid administrator email.");
  }
  return email;
}

export function validateAdminPassword(password, confirmation = password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    password.length > 1024 ||
    password !== confirmation
  ) {
    throw new Error("Password did not meet requirements or confirmation differed.");
  }
  return password;
}

export function getNonInteractiveCredentials(env = process.env) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      "Non-interactive provisioning requires ADMIN_EMAIL and ADMIN_PASSWORD."
    );
  }

  return {
    email: validateAdminEmail(env.ADMIN_EMAIL),
    password: validateAdminPassword(env.ADMIN_PASSWORD),
  };
}

export async function provisionAdmin(prismaClient, { email, password }) {
  const passwordHash = await createPasswordHash(password);
  return prismaClient.adminUser.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
      passwordChangedAt: new Date(),
    },
    select: { id: true },
  });
}

async function getInteractiveCredentials(input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Interactive terminal required.");
  }

  const email = validateAdminEmail(await ask("Administrator email: ", input, output));
  const password = await askHidden("Password (input hidden): ", input, output);
  const confirmation = await askHidden("Confirm password (input hidden): ", input, output);

  return { email, password: validateAdminPassword(password, confirmation) };
}

export async function runProvisionAdmin({
  args = process.argv.slice(2),
  env = process.env,
  input = process.stdin,
  output = process.stdout,
  errorOutput = process.stderr,
  createPrismaClient = () => new PrismaClient(),
} = {}) {
  let prismaClient;
  try {
    const unknownArgs = args.filter((arg) => arg !== "--non-interactive");
    if (unknownArgs.length > 0 || args.length > 1) {
      throw new Error("Unsupported provisioning arguments.");
    }

    const credentials = args.includes("--non-interactive")
      ? getNonInteractiveCredentials(env)
      : await getInteractiveCredentials(input, output);

    prismaClient = createPrismaClient();
    await provisionAdmin(prismaClient, credentials);
    output.write("Administrator account provisioned.\n");
    return true;
  } catch {
    errorOutput.write(
      "Admin provisioning failed. Check the database connection, email uniqueness, and supplied credentials.\n"
    );
    return false;
  } finally {
    if (prismaClient) {
      try {
        await prismaClient.$disconnect();
      } catch {
        errorOutput.write("Database client cleanup failed.\n");
        process.exitCode = 1;
      }
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const succeeded = await runProvisionAdmin();
  if (!succeeded) process.exitCode = 1;
}
