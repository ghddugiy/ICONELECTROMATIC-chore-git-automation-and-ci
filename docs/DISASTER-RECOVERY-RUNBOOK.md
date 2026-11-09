# Disaster Recovery and Backup Runbook

This is a procedure template for the client's technical operator. Production
provider names, regions, connection details, retention periods, recovery
objectives, and escalation contacts are client decisions and are intentionally
left as placeholders.

> **Production approval gate:** Any action against a production database,
> production R2 bucket, production account, DNS, or live email configuration
> requires explicit client authorization and access from the client's approved
> operator. This guide has not accessed or tested client production systems.
> Never paste secrets into tickets, shell history, documentation, or logs.

## 1. Scope and roles

Record before launch:

| Item | Client value |
|---|---|
| Frontend host and project | `CLIENT_FRONTEND_HOST_AND_PROJECT` |
| Backend host and service | `CLIENT_BACKEND_HOST_AND_SERVICE` |
| PostgreSQL provider/database/region | `CLIENT_DATABASE_PROVIDER_DB_REGION` |
| R2 account/bucket/region | `CLIENT_R2_ACCOUNT_BUCKET_REGION` |
| Resend account/domain/sending region | `CLIENT_RESEND_ACCOUNT_DOMAIN_REGION` |
| Primary incident owner and backup | `CLIENT_APPROVED_CONTACTS` |
| Approved recovery time/point objectives | `CLIENT_APPROVED_RTO_RPO` |
| Backup retention and storage location | `CLIENT_APPROVED_BACKUP_POLICY` |

Assign one incident lead, one database operator, and one communications owner.
Restrict production access to named authorized operators; use a separate
recovery environment for restore validation.

## 2. PostgreSQL backups

### Preferred provider backups

Use the database provider's managed backups/PITR where available. Confirm that
backups cover the database and required objects, retention meets client policy,
encryption and access controls are enabled, and a restore has been tested into a
separate recovery database. A backup that has never been restored is not a
verified recovery plan.

### Optional logical backup with PostgreSQL tools

Run only from an approved operator environment with a supported `pg_dump`
version. Configure a named libpq service and set `PGSERVICEFILE` to the client's
secure service file outside the repository; set `CLIENT_PG_SERVICE` to that
service name in the approved operator environment. Do not put a connection
password in the command line or commit a service file.

```sh
# Set CLIENT_PG_SERVICE and BACKUP_FILE through the approved operator environment.
pg_dump --format=custom --no-owner --no-acl \
  --file="$BACKUP_FILE" \
  --dbname="service=$CLIENT_PG_SERVICE"

# Verify the archive can be read; this does not restore or change a database.
pg_restore --list "$BACKUP_FILE"
```

Store the encrypted backup in the client's approved backup location, restrict
access, record its timestamp/checksum/retention, and ensure the archive does not
contain credentials. Client policy determines backup cadence and retention.

**Authorization required:** production backup access/export, transfer, retention
changes, and deletion of old backup copies.

## 3. Restore procedure

1. Declare the incident and have the client incident owner approve the restore
   point and scope. Stop or coordinate writes to avoid restoring over new data.
2. Select a verified backup and create an isolated, empty recovery database with
   the client's DBA/provider. Do not start by overwriting production.
3. Configure `CLIENT_RECOVERY_PG_SERVICE` through the approved secure operator
   environment and restore:

   ```sh
   pg_restore --no-owner --no-acl \
     --dbname="service=$CLIENT_RECOVERY_PG_SERVICE" \
     "$BACKUP_FILE"
   ```

4. Validate the recovery copy using the checklist below, the application health
   endpoints, and approved application smoke tests.
5. Present results, data-loss window, and cutover plan to the client approver.
   Production cutover/overwrite requires explicit client authorization.
6. Preserve the pre-restore production state according to the incident plan;
   never delete the original database or backup as part of an unreviewed fix.

For provider-native PITR, follow the provider's approved runbook and restore to a
new instance/database first. The exact controls depend on the client provider.

## 4. Prisma migration recovery

- Confirm the exact `DATABASE_URL` target through the approved secret store
  without printing the URL. Verify backup status and the maintenance window.
- From `backend/`, inspect migration state:

  ```sh
  npx prisma migrate status
  ```

- Normal deployment applies checked-in pending migrations with:

  ```sh
  npm run migrate
  ```

- If a migration fails, stop deployment, preserve complete logs, record the
  migration name and Prisma error code, and escalate to the application/database
  owner. Do not run `prisma migrate reset`, manually edit the production schema,
  delete migration history, or edit an already-applied migration.
- Recovery may require an app fix/new forward migration or restoring a verified
  backup to a separate database. A production restore or migration-resolution
  command must be explicitly approved by the client DBA and application owner.
- Re-run migration status after an approved fix and verify application health.

## 5. Catalogue recovery and reseeding

Preferred recovery for a complete database loss is restoring the database
backup. Catalogue import is not a substitute for restoring enquiries, CMS
content, users, audit records, sessions, or media metadata.

The baseline source is `shared/catalogData.js`. The Admin CMS transfer performs
a dry-run validation before an atomic transfer. The production baseline seeder
is a separate backend script, read-only by default, and refuses inconsistent
partial catalogues. It does not replace existing catalogue rows.

**Authorization required:** client approval, confirmed production target, and a
verified backup before any seed/apply action. From `backend/`, the read-only
inspection is:

```sh
npm run seed:production-catalog
```

Applying requires `PRODUCTION_DATABASE_URL`, `--apply`, and the exact target
confirmation described in [CLIENT-HANDOVER-GUIDE.md](./CLIENT-HANDOVER-GUIDE.md).
The seeder rejects `sslmode=require` and `sslmode=verify-ca`; use
`sslmode=verify-full` so the database certificate and hostname are verified.
Do not run the apply command as a speculative recovery fix. Verify counts and
catalogue hierarchy after an approved import.

The test-only script `node scripts/verify-baseline-catalog.js` is restricted to
the local test database and port 5433; do not use it for production recovery.

## 6. Administrator account recovery

The interactive provisioning command creates a new active `ADMIN` user and
requires the database to be available:

```sh
# From backend/, use an interactive terminal and enter the password only
# into the hidden prompt.
node scripts/provision-admin.js
```

It does not reset or replace an existing user's password. For a lost admin
account, first use an authorized existing administrator or the client's approved
database-admin recovery process. If provisioning a new administrator is
necessary, obtain client authorization, use a unique strong password, follow
least privilege/access approval, then verify login and remove any temporary
secret values. Do not delete users or modify password hashes directly without
an approved, reviewed recovery procedure.

Non-interactive provisioning uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from a
secret manager and `node scripts/provision-admin.js --non-interactive`. The
password must not be in arguments, shell history, logs, or this runbook.

## 7. Cloudflare R2 media recovery

- R2 credentials are backend-only. Keep the bucket private by default and use
  client-approved bucket-scoped credentials.
- This application mediates uploads through `POST /api/media/upload` and
  delivers by `GET /api/media/file/:id`; public access behavior changes if
  `R2_PUBLIC_DOMAIN` is configured.
- The database stores media metadata and R2 object keys; database backups do not
  include R2 object contents. Coordinate PostgreSQL restore points with the
  client's R2 retention/backup policy to avoid metadata/object mismatches.
- R2 object versioning, scheduled retirement/purge, automated bulk migration,
  and automatic restoration of deleted objects are not implemented or assumed.
  Ask the client R2 administrator to confirm current provider capabilities and
  approved retention/recovery options.
- Do not test restoration by deleting, replacing, or uploading objects in a
  production bucket. Validate any restore process in a separate non-production
  bucket first.

## 8. Resend and email incident troubleshooting

1. Check backend service health and sanitized application logs for email
   configuration or provider error messages; do not log API keys or full
   message contents.
2. Verify in the backend secret store that `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, and `CONTACT_EMAIL` are configured. `ENQUIRY_FROM` is
   legacy fallback only.
3. Check the client's Resend account for sender-domain verification, sending
   region, API key status/permissions, provider delivery status, and account
   limits.
4. Have the authorized DNS/mail administrator verify the exact records displayed
   in the client's Resend account. Coordinate SPF/DMARC changes with existing
   mail routing; do not replace records speculatively.
5. Confirm the expected regional recipient mailboxes are active and receiving.
   Regional recipients are server-side configured in application code; `CONTACT_EMAIL`
   is the fallback/general recipient.
6. Use a client-approved test address and explicit approval for any live email
   test. This runbook task does not send email.
7. Enquiries are stored before notification dispatch; inspect the Admin enquiry
   status/communication history for `EMAIL_FAILED` and delivery diagnostics.
   Protect customer personal data during investigation and escalation.

## 9. Logs, investigation, and escalation

- Check the frontend host build/deployment logs, backend service logs, managed
  PostgreSQL events, R2 provider audit/activity records, and Resend delivery
  events in their respective client-controlled consoles.
- Backend exposes `GET /api/health` and `GET /api/health/db`. The database check
  reports connectivity only; it is not a backup or data-integrity check.
- Preserve timestamps with timezone, request/incident IDs when available,
  migration names, sanitized provider error codes, and affected service.
- Do not attach connection strings, API keys, passwords, session cookies,
  CSRF tokens, full enquiry bodies, or unredacted personal data to logs/tickets.
- Escalate data loss, suspected credential exposure, repeated failed migrations,
  unauthorized access, unexpected mail delivery, or R2 object loss to the client
  incident owner and relevant provider immediately.
- Rotate credentials only through client-approved provider procedures and update
  the backend secret store; never share replacement secrets in chat or email.

## 10. Recovery verification checklist

- [ ] Client incident lead approved recovery point, scope, and any production action.
- [ ] Backup source, timestamp, checksum, and restore procedure were verified.
- [ ] Recovery database is isolated; production was not overwritten during validation.
- [ ] `npx prisma migrate status` reports expected migration state on the recovery target.
- [ ] `GET /api/health` and `GET /api/health/db` return expected healthy responses.
- [ ] Catalogue hierarchy and counts were checked against an approved source.
- [ ] Admin login works and only authorized active administrators can access the portal.
- [ ] Enquiry records and communication history are present and readable by authorized staff.
- [ ] Site content, SEO, media metadata, and import history were sampled for expected integrity.
- [ ] R2 object availability and database metadata are consistent using a non-destructive check.
- [ ] Email configuration and regional routing are checked without sending unapproved messages.
- [ ] DNS, TLS, same-origin API proxy, sitemap, and prerendered page routes are checked after authorized cutover.
- [ ] Client owner accepted recovery results, documented data-loss window, and approved return to service.

## 11. Local Docker PostgreSQL is development/test only

The existing local Docker PostgreSQL container is used for development and
testing, with the test database `icon_electromatic_test` on port `5433`. It is
not production infrastructure. The test-only catalog verifier hard-codes that
database/port. Do not add a production Dockerfile or Compose stack unless the
client's selected hosting architecture specifically requires it.
