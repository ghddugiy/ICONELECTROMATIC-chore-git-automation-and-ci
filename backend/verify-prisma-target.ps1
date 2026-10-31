[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$backendDirectory = $PSScriptRoot
$nodeCommand = Get-Command -Name 'node.exe' -CommandType Application -ErrorAction Stop

$nodeScript = @'
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const dotenv = require("dotenv");

try {
  let connectionUrl;

  if (process.env.DATABASE_URL !== undefined) {
    connectionUrl = process.env.DATABASE_URL;
  } else {
    const dotenvPath = path.join(process.cwd(), ".env");
    const parsedEnvironment = dotenv.parse(fs.readFileSync(dotenvPath, "utf8"));

    if (!Object.prototype.hasOwnProperty.call(parsedEnvironment, "DATABASE_URL")) {
      throw new Error();
    }

    connectionUrl = parsedEnvironment.DATABASE_URL;
  }

  if (typeof connectionUrl !== "string" || connectionUrl.length === 0) {
    throw new Error();
  }

  const parsedUrl = new URL(connectionUrl);
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new Error();
  }

  if (!parsedUrl.hostname || !parsedUrl.pathname.replace(/^\/+/, "")) {
    throw new Error();
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  const schemas = parsedUrl.searchParams.getAll("schema");
  if (schemas.length > 1) {
    throw new Error();
  }

  process.stdout.write(JSON.stringify({
    hostname: parsedUrl.hostname || "(not specified)",
    port: parsedUrl.port || "(not specified)",
    databaseName: databaseName || "(not specified)",
    schema: schemas.length === 1 ? schemas[0] : null
  }));
} catch {
  process.stderr.write("Unable to safely determine the configured database target.\n");
  process.exitCode = 1;
}
'@

Push-Location -LiteralPath $backendDirectory
try {
    $nodeOutput = @($nodeScript | & $nodeCommand.Source --input-type=module 2>$null)
    $nodeExitCode = $LASTEXITCODE

    if ($nodeExitCode -ne 0 -or $nodeOutput.Count -ne 1) {
        throw 'Unable to safely determine the configured database target.'
    }

    try {
        $target = $nodeOutput[0] | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        throw 'Unable to safely parse the sanitized target report.'
    }

    Write-Output "Hostname: $($target.hostname)"
    Write-Output "Port: $($target.port)"
    Write-Output "Database: $($target.databaseName)"

    if ($null -eq $target.schema) {
        Write-Output 'URL schema parameter: not configured'
        Write-Output 'Actual PostgreSQL schema: not verified by this script.'
    }
    elseif ($target.schema -ceq 'public') {
        Write-Output 'URL schema parameter: public'
        Write-Output 'Actual PostgreSQL schema: not verified by this script.'
    }
    else {
        Write-Output "URL schema parameter: $($target.schema)"
        Write-Output 'URL schema parameter does not match the intended public parameter.'
        Write-Output 'Actual PostgreSQL schema: not verified by this script.'
    }

    if ($target.databaseName -ceq 'icon_electromatic') {
        Write-Output 'Intended database icon_electromatic: matches'
    }
    else {
        Write-Output 'Intended database icon_electromatic: does not match'
    }
}
finally {
    Pop-Location
}
