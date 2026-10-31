import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createInterface } from "node:readline";
import { createPasswordHash } from "../src/auth/security.js";

const prisma = new PrismaClient();

function ask(question) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

function askHidden(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(new Error("Interactive terminal required."));
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;

    function finish(error) {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
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

    process.stdout.write(question);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function provisionAdmin() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive terminal required.");
  }

  const email = (await ask("Administrator email: ")).trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Invalid administrator email.");
  }

  const password = await askHidden("Password (input hidden): ");
  const confirmation = await askHidden("Confirm password (input hidden): ");

  if (
    password.length < 14 ||
    password.length > 1024 ||
    password !== confirmation
  ) {
    throw new Error("Password did not meet requirements or confirmation differed.");
  }

  const passwordHash = await createPasswordHash(password);
  await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
      passwordChangedAt: new Date(),
    },
    select: { id: true },
  });

  process.stdout.write("Administrator account provisioned.\n");
}

try {
  await provisionAdmin();
} catch {
  process.stderr.write(
    "Admin provisioning failed. Check the database connection, email uniqueness, and interactive password requirements.\n"
  );
  process.exitCode = 1;
} finally {
  try {
    await prisma.$disconnect();
  } catch {
    process.stderr.write("Database client cleanup failed.\n");
    process.exitCode = 1;
  }
}
