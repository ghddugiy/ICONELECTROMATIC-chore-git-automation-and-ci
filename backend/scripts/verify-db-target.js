/**
 * verify-db-target.js
 *
 * Pre-flight safety check to verify that a target database URL:
 * 1. Has valid postgresql: protocol
 * 2. Connects strictly to a local host (localhost / 127.0.0.1)
 * 3. Targets an explicitly designated test database name (e.g. icon_electromatic_test)
 * 4. Does NOT match the developer database configured in backend/.env
 * 5. Does NOT connect to any client or production database
 * 6. Never logs passwords or credentials
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Sanitize a database URL for safe logging (strip credentials).
 * @param {string} urlString
 * @returns {string}
 */
export function sanitizeDatabaseUrl(urlString) {
  try {
    const u = new URL(urlString);
    u.username = '***';
    u.password = '***';
    return u.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

/**
 * Parse and validate database target details.
 * @param {string} urlString
 * @returns {{ protocol: string, hostname: string, port: string, databaseName: string, sanitized: string }}
 */
export function parseDatabaseTarget(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Database URL is required and must be a string.');
  }

  let u;
  try {
    u = new URL(urlString);
  } catch (err) {
    throw new Error(`Invalid URL format: ${err.message}`);
  }

  if (u.protocol !== 'postgresql:' && u.protocol !== 'postgres:') {
    throw new Error(`Disallowed protocol "${u.protocol}". Must be postgresql: or postgres:`);
  }

  const hostname = (u.hostname || '').toLowerCase();
  const port = u.port || '5432';
  const databaseName = (u.pathname || '').replace(/^\//, '').trim();

  if (!databaseName) {
    throw new Error('Database name is missing in database URL pathname.');
  }

  const sanitized = sanitizeDatabaseUrl(urlString);

  return {
    protocol: u.protocol,
    hostname,
    port,
    databaseName,
    sanitized,
  };
}

/**
 * Get developer database name from backend/.env if it exists.
 * @returns {string|null}
 */
export function getDeveloperDatabaseName() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return null;

  try {
    const content = readFileSync(envPath, 'utf8');
    const match = content.match(/^DATABASE_URL\s*=\s*([^\r\n]+)/m);
    if (!match) return null;

    let val = match[1].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    const u = new URL(val);
    return (u.pathname || '').replace(/^\//, '').trim() || null;
  } catch {
    return null;
  }
}

/**
 * Main safety verification function.
 * @param {object} options
 * @param {string} [options.targetUrl] - Database URL to verify (defaults to process.env.TEST_DATABASE_URL or process.env.DATABASE_URL)
 * @param {string} [options.expectedDbName] - Expected database name (defaults to "icon_electromatic_test")
 * @returns {{ ok: boolean, details: object }}
 */
export function verifyDatabaseSafety({
  targetUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  expectedDbName = 'icon_electromatic_test',
  expectedPort = null,
} = {}) {
  if (!targetUrl) {
    throw new Error('No target database URL provided (neither TEST_DATABASE_URL nor DATABASE_URL is set).');
  }

  const target = parseDatabaseTarget(targetUrl);
  const targetPort = Number.parseInt(String(target.port || 5432), 10);

  if (!Number.isInteger(targetPort) || targetPort <= 0) {
    throw new Error('SAFETY VIOLATION: Invalid database port.');
  }

  // 1. Host safety check: strictly localhost or 127.0.0.1
  const isLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
  if (!isLocal) {
    throw new Error(
      `SAFETY VIOLATION: Database host "${target.hostname}" is not local (localhost / 127.0.0.1). Refusing to connect to remote/production host.`
    );
  }

  // 2. Developer Database & Port 5432 protection (type-safe)
  const devDbName = getDeveloperDatabaseName();
  if (targetPort === 5432 || target.databaseName === 'icon_electromatic' || (devDbName && target.databaseName === devDbName)) {
    throw new Error(
      'SAFETY VIOLATION: Target connects to developer database or port 5432. Operation aborted to protect developer data.'
    );
  }

  // 3. Expected port check (enforced only when caller passes expectedPort)
  if (expectedPort !== null && expectedPort !== undefined) {
    const requiredPort = Number.parseInt(String(expectedPort), 10);
    if (targetPort !== requiredPort) {
      throw new Error(
        `SAFETY VIOLATION: Target database port ${targetPort} does not match expected port ${requiredPort}.`
      );
    }
  }

  // 4. Expected database name match
  if (expectedDbName && target.databaseName !== expectedDbName) {
    throw new Error(
      `SAFETY VIOLATION: Target database name "${target.databaseName}" does not match expected test database name "${expectedDbName}".`
    );
  }

  return {
    ok: true,
    details: {
      hostname: target.hostname,
      port: targetPort,
      databaseName: target.databaseName,
      sanitizedUrl: target.sanitized,
      developerDatabaseName: devDbName,
    },
  };
}

// Direct execution CLI entrypoint
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const expectedDb = process.argv[2] || process.env.EXPECTED_DB_NAME || 'icon_electromatic_test';
  try {
    const result = verifyDatabaseSafety({ expectedDbName: expectedDb });
    console.log('[DB-SAFETY-CHECK: PASS] Target verified safe:');
    console.log(`  Host: ${result.details.hostname}`);
    console.log(`  Port: ${result.details.port}`);
    console.log(`  Target Database: ${result.details.databaseName}`);
    console.log(`  Developer Database: ${result.details.developerDatabaseName || '(none)'}`);
    console.log(`  Sanitized URL: ${result.details.sanitizedUrl}`);
    process.exit(0);
  } catch (err) {
    console.error(`[DB-SAFETY-CHECK: FAILED] ${err.message}`);
    process.exit(1);
  }
}
