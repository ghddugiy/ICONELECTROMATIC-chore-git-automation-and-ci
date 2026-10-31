import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const DUMMY_SALT = Buffer.alloc(PASSWORD_SALT_LENGTH, 0x5a);
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

async function derivePasswordKey(password, salt) {
  return scrypt(password, salt, PASSWORD_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
}

export async function createPasswordHash(password) {
  const salt = randomBytes(PASSWORD_SALT_LENGTH);
  const derivedKey = await derivePasswordKey(password, salt);

  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password, storedHash) {
  const parts =
    typeof storedHash === "string" ? storedHash.split("$") : [];
  const validFormat =
    parts.length === 6 &&
    parts[0] === "scrypt" &&
    parts[1] === String(SCRYPT_COST) &&
    parts[2] === String(SCRYPT_BLOCK_SIZE) &&
    parts[3] === String(SCRYPT_PARALLELIZATION) &&
    /^[a-f0-9]{32}$/.test(parts[4]) &&
    /^[a-f0-9]{128}$/.test(parts[5]);

  if (!validFormat) {
    await derivePasswordKey(password, DUMMY_SALT);
    return false;
  }

  const salt = Buffer.from(parts[4], "hex");
  const expectedKey = Buffer.from(parts[5], "hex");
  const actualKey = await derivePasswordKey(password, salt);

  return timingSafeEqual(actualKey, expectedKey);
}

export function createOpaqueToken() {
  return randomBytes(32).toString("hex");
}

export function hashOpaqueToken(token) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    return null;
  }

  return createHash("sha256").update(token, "ascii").digest("hex");
}

export function tokenMatchesHash(token, expectedHash) {
  const actualHash = hashOpaqueToken(token);
  if (
    actualHash === null ||
    typeof expectedHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}

export function getAuthCookieNames(isProduction) {
  return isProduction
    ? {
        session: "__Host-admin_session",
        csrf: "__Host-admin_csrf",
      }
    : {
        session: "admin_session",
        csrf: "admin_csrf",
      };
}

export function readCookie(header, name) {
  if (typeof header !== "string") {
    return null;
  }

  let found = null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) {
      continue;
    }

    if (found !== null) {
      return null;
    }
    found = part.slice(separator + 1).trim();
  }

  return found;
}

export function hasValidCsrfRequest({
  cookieHeader,
  csrfCookieName,
  csrfTokenHash,
  headerToken,
}) {
  const cookieToken = readCookie(cookieHeader, csrfCookieName);
  if (
    cookieToken === null ||
    typeof headerToken !== "string" ||
    !TOKEN_PATTERN.test(cookieToken) ||
    !TOKEN_PATTERN.test(headerToken)
  ) {
    return false;
  }

  const cookieBytes = Buffer.from(cookieToken, "ascii");
  const headerBytes = Buffer.from(headerToken, "ascii");
  if (!timingSafeEqual(cookieBytes, headerBytes)) {
    return false;
  }

  return tokenMatchesHash(cookieToken, csrfTokenHash);
}

export function appendAuthCookies(res, {
  sessionToken,
  csrfToken,
  maxAgeSeconds,
  isProduction,
}) {
  const names = getAuthCookieNames(isProduction);
  const secure = isProduction ? "; Secure" : "";
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));

  res.append(
    "Set-Cookie",
    `${names.session}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`
  );
  res.append(
    "Set-Cookie",
    `${names.csrf}=${csrfToken}; Path=/; SameSite=Lax${secure}; Max-Age=${maxAge}`
  );
}

export function clearAuthCookies(res, isProduction) {
  const names = getAuthCookieNames(isProduction);
  const secure = isProduction ? "; Secure" : "";
  const expired = "; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

  res.append(
    "Set-Cookie",
    `${names.session}=${expired}; HttpOnly${secure}`
  );
  res.append(
    "Set-Cookie",
    `${names.csrf}=${expired}${secure}`
  );
}
