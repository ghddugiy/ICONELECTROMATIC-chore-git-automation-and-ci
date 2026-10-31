[CmdletBinding()]
param(
    [string]$PsqlPath = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-RequiredValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    $value = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$Prompt must not be empty."
    }

    return $value.Trim()
}

function Read-PostgresPort {
    $portText = Read-RequiredValue -Prompt 'PostgreSQL port'
    $port = 0

    if (-not [int]::TryParse($portText, [ref]$port) -or $port -lt 1 -or $port -gt 65535) {
        throw 'The port must be a number from 1 through 65535.'
    }

    return $port
}

function ConvertTo-PostgresTextExpression {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    if ($Value.IndexOf([char]0) -ge 0) {
        throw 'The schema name cannot contain a NUL character.'
    }

    $utf8 = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList @($false, $true)
    $bytes = $utf8.GetBytes($Value)
    $hex = [System.BitConverter]::ToString($bytes).Replace('-', '')

    return "pg_catalog.convert_from(pg_catalog.decode('$hex', 'hex'), 'UTF8')"
}

if (-not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
    throw "PostgreSQL client executable was not found: $PsqlPath"
}

$psqlExecutable = (Get-Item -LiteralPath $PsqlPath -ErrorAction Stop).FullName

$hostName = Read-RequiredValue -Prompt 'PostgreSQL host'
$port = Read-PostgresPort
$databaseName = Read-RequiredValue -Prompt 'PostgreSQL database name'
$userName = Read-RequiredValue -Prompt 'PostgreSQL user name'
$schemaName = Read-RequiredValue -Prompt 'PostgreSQL schema name'

$schemaExpression = ConvertTo-PostgresTextExpression -Value $schemaName

$targetConfirmation = '{0}|{1}|{2}|{3}|{4}' -f $hostName, $port, $databaseName, $userName, $schemaName
Write-Host ''
Write-Host "Configured target (host|port|database|user|schema): $targetConfirmation"
$confirmation = Read-Host 'Type the exact target shown above to continue'

if ($confirmation -cne $targetConfirmation) {
    throw 'Target confirmation did not match; no connection was made.'
}

$sqlTemplate = @'
BEGIN TRANSACTION READ ONLY;

DO $schema_check$
DECLARE
    selected_schema text := __SCHEMA_EXPR__;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_namespace
        WHERE nspname = selected_schema
    ) THEN
        RAISE EXCEPTION
            'Selected schema "%" does not exist in database "%".',
            selected_schema,
            current_database();
    END IF;
END
$schema_check$;

SELECT current_database() AS connected_database,
       d.datallowconn
FROM pg_catalog.pg_database AS d
WHERE d.datname = current_database();

SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
           WHEN 'r' THEN 'table'
           WHEN 'p' THEN 'partitioned table'
           WHEN 'v' THEN 'view'
           WHEN 'm' THEN 'materialized view'
           WHEN 'f' THEN 'foreign table'
       END AS object_type,
       c.relpersistence AS persistence
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = __SCHEMA_EXPR__
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY n.nspname, c.relname;

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       a.attnum AS ordinal_position,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       NOT a.attnotnull AS is_nullable,
       a.atthasdef AS has_default
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c
  ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = __SCHEMA_EXPR__
  AND c.relkind IN ('r', 'p')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY n.nspname, c.relname, a.attnum;

SELECT n.nspname AS schema_name,
       table_class.relname AS table_name,
       index_class.relname AS index_name,
       i.indisprimary AS is_primary,
       i.indisunique AS is_unique,
       i.indisvalid AS is_valid,
       access_method.amname AS access_method,
       pg_catalog.pg_get_indexdef(i.indexrelid) AS index_definition
FROM pg_catalog.pg_index AS i
JOIN pg_catalog.pg_class AS table_class
  ON table_class.oid = i.indrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = table_class.relnamespace
JOIN pg_catalog.pg_class AS index_class
  ON index_class.oid = i.indexrelid
JOIN pg_catalog.pg_am AS access_method
  ON access_method.oid = index_class.relam
WHERE n.nspname = __SCHEMA_EXPR__
ORDER BY n.nspname, table_class.relname, index_class.relname;

SELECT n.nspname AS schema_name,
       table_class.relname AS table_name,
       constraint_info.conname AS foreign_key_name,
       pg_catalog.pg_get_constraintdef(constraint_info.oid) AS definition
FROM pg_catalog.pg_constraint AS constraint_info
JOIN pg_catalog.pg_class AS table_class
  ON table_class.oid = constraint_info.conrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = table_class.relnamespace
WHERE n.nspname = __SCHEMA_EXPR__
  AND constraint_info.contype = 'f'
ORDER BY n.nspname, table_class.relname, constraint_info.conname;

SELECT n.nspname AS schema_name,
       table_class.relname AS table_name,
       constraint_info.conname AS check_constraint_name,
       pg_catalog.pg_get_constraintdef(constraint_info.oid) AS definition
FROM pg_catalog.pg_constraint AS constraint_info
JOIN pg_catalog.pg_class AS table_class
  ON table_class.oid = constraint_info.conrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = table_class.relnamespace
WHERE n.nspname = __SCHEMA_EXPR__
  AND constraint_info.contype = 'c'
ORDER BY n.nspname, table_class.relname, constraint_info.conname;

SELECT n.nspname AS schema_name,
       enum_type.typname AS enum_name,
       enum_label.enumlabel AS enum_label,
       enum_label.enumsortorder AS sort_order
FROM pg_catalog.pg_type AS enum_type
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = enum_type.typnamespace
JOIN pg_catalog.pg_enum AS enum_label
  ON enum_label.enumtypid = enum_type.oid
WHERE n.nspname = __SCHEMA_EXPR__
ORDER BY n.nspname, enum_type.typname, enum_label.enumsortorder;

SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n
      ON n.oid = c.relnamespace
    WHERE n.nspname = __SCHEMA_EXPR__
      AND c.relname = '_prisma_migrations'
      AND c.relkind IN ('r', 'p')
) AS migration_table_exists
\gset

\if :migration_table_exists
SELECT pg_catalog.format(
    'SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count,
            %L::text AS verification_status
     FROM %I.%I
     ORDER BY started_at NULLS LAST, migration_name',
    'TABLE_FOUND',
    (
        SELECT n.nspname::text
        FROM pg_catalog.pg_namespace AS n
        WHERE n.nspname = __SCHEMA_EXPR__
    ),
    '_prisma_migrations'
)
\gexec
\else
SELECT NULL::text AS migration_name,
       NULL::timestamp with time zone AS started_at,
       NULL::timestamp with time zone AS finished_at,
       NULL::timestamp with time zone AS rolled_back_at,
       NULL::integer AS applied_steps_count,
       'TABLE_NOT_FOUND'::text AS verification_status;
\endif

COMMIT;
'@

$sql = $sqlTemplate.Replace('__SCHEMA_EXPR__', $schemaExpression)

$tempDirectoryName = 'icon-db-verify-' + [guid]::NewGuid().ToString('N')
$tempDirectoryPath = Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath $tempDirectoryName
$tempSqlPath = Join-Path -Path $tempDirectoryPath -ChildPath 'verification.sql'
$tempDirectoryCreated = $false
$previousPgUser = [System.Environment]::GetEnvironmentVariable('PGUSER', 'Process')
$psqlExitCode = $null

try {
    $currentUserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = New-Object -TypeName System.Security.Principal.SecurityIdentifier -ArgumentList 'S-1-5-18'

    $directorySecurity = New-Object -TypeName System.Security.AccessControl.DirectorySecurity
    $directorySecurity.SetAccessRuleProtection($true, $false)

    $inheritanceFlags = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $propagationFlags = [System.Security.AccessControl.PropagationFlags]::None
    $allow = [System.Security.AccessControl.AccessControlType]::Allow
    $fullControl = [System.Security.AccessControl.FileSystemRights]::FullControl

    $currentUserRule = New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
        $currentUserSid,
        $fullControl,
        $inheritanceFlags,
        $propagationFlags,
        $allow
    )
    $systemRule = New-Object -TypeName System.Security.AccessControl.FileSystemAccessRule -ArgumentList @(
        $systemSid,
        $fullControl,
        $inheritanceFlags,
        $propagationFlags,
        $allow
    )

    $directorySecurity.AddAccessRule($currentUserRule)
    $directorySecurity.AddAccessRule($systemRule)

    [void][System.IO.Directory]::CreateDirectory($tempDirectoryPath, $directorySecurity)
    $tempDirectoryCreated = $true

    $utf8WithoutBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($tempSqlPath, $sql, $utf8WithoutBom)

    $env:PGUSER = $userName

    $psqlArguments = @(
        '--no-psqlrc'
        '--set=ON_ERROR_STOP=1'
        "--host=$hostName"
        "--port=$port"
        "--dbname=$databaseName"
        '--password'
        "--file=$tempSqlPath"
    )

    & $psqlExecutable @psqlArguments
    $psqlExitCode = $LASTEXITCODE
}
finally {
    if ($null -eq $previousPgUser) {
        Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
    }
    else {
        $env:PGUSER = $previousPgUser
    }

    if ($tempDirectoryCreated -and (Test-Path -LiteralPath $tempDirectoryPath)) {
        Remove-Item -LiteralPath $tempDirectoryPath -Recurse -Force -ErrorAction Stop
    }
}

if ($null -eq $psqlExitCode) {
    throw 'psql did not return an exit code.'
}

if ($psqlExitCode -ne 0) {
    throw "psql exited with code $psqlExitCode."
}
