# CMS catalog API

All responses are JSON with a `success` boolean and, on success, a `data` field.
Public catalog reads return visible records only. Categories whose OEM is hidden
and products whose category or OEM is hidden are also omitted. Lists are ordered
by `sortOrder`, then ID.

## Public reads

| Method and path | Behavior |
| --- | --- |
| `GET /api/oems` | List visible OEMs |
| `GET /api/oems/:id` | Get a visible OEM |
| `GET /api/categories?oemId=:id` | List visible categories, optionally filtered by OEM |
| `GET /api/categories/:id` | Get a visible category |
| `GET /api/products?categoryId=:id` | List visible products, optionally filtered by category |
| `GET /api/products/:id` | Get a visible product |

Public responses omit the raw `sourceData` object, version fields, and the
internal `sourceImagePath` property. They expose the catalog fields needed by the
website, including the currently stored image reference.

## Admin catalog reads

These reads require an active `ADMIN` session cookie. They include hidden
records and return `sourceData` so the frontend editor can preserve legacy CMS
fields that do not have dedicated database columns.

| Method and path | Behavior |
| --- | --- |
| `GET /api/oems/admin` | List all OEMs, including hidden records and `sourceData` |
| `GET /api/categories/admin?oemId=:id` | List all categories, optionally filtered by OEM |
| `GET /api/products/admin?categoryId=:id` | List all products, optionally filtered by category |

## Admin authentication

There is no public registration or default admin account. An administrator must
be provisioned once through the interactive local procedure below.

| Method and path | Behavior |
| --- | --- |
| `POST /api/auth/login` | Verify administrator credentials and create a database-backed session |
| `GET /api/auth/session` | Return the current administrator and CSRF token |
| `POST /api/auth/logout` | Revoke the current session and clear authentication cookies |

Login request example:

```json
{
  "email": "admin@example.invalid",
  "password": "entered securely by the administrator"
}
```

The password must never be sent in a URL or written to logs. Login failures use
the same response for unknown users, invalid passwords, inactive users, and
non-admin roles. Successful login sets an HttpOnly session cookie and a separate
CSRF cookie. Production cookies use `Secure`, `SameSite=Lax`, and `Path=/`; the
session cookie is HttpOnly. State-changing authenticated requests must send the
CSRF cookie value in the `X-CSRF-Token` header. Browser clients must use
credentialed requests (`credentials: "include"`), and the exact configured
frontend origin is the only CORS origin allowed. The frontend and API must be
same-site for `SameSite=Lax` cookies to be sent by browsers.

Sessions expire after a fixed eight-hour lifetime and are checked against the
database on protected requests. Logout revokes the current session. Passwords
are stored with Node.js scrypt using a random salt; session and CSRF tokens are
random, and only their SHA-256 hashes are stored in `AdminSession`.

Login limiting allows at most five attempts per client address in a 15-minute
window and is process-local. It is a basic safeguard, not a distributed or
multi-instance rate limiter. Production
deployment behind a reverse proxy must configure trusted proxy handling and
replace or supplement this limiter with a shared rate-limit service. Do not
consider this authentication implementation production-ready without that
deployment review, HTTPS, and operational verification.

### One-time admin provisioning

From a trusted terminal, run `node scripts/provision-admin.js` with the current
working directory set to `backend`. The script prompts for the administrator
email and reads the password and confirmation without echoing them. Do not pass
passwords as command-line arguments, environment values, or shell input; do not
redirect the prompts or output to a transcript. The script only creates an
active `ADMIN` user and does not reset or modify an existing user. Choose a
unique password of at least 14 characters. Confirm the backend's database
target before running it.

## Write routes

Write routes require an active `ADMIN` account with a valid session and CSRF
token. `EDITOR` users cannot perform admin writes. No registration or default
admin credentials exist.

The frontend compares catalog changes against its last server snapshot and sends
only changed records. Reconciliation of existing browser data is preview-only:
an empty backend leaves the browser catalog read-only, and no records are
imported automatically.

| Method and path | Behavior |
| --- | --- |
| `POST /api/oems` | Create an OEM |
| `PATCH /api/oems/:id` | Update OEM fields |
| `PATCH /api/oems/:id/visibility` | Set visibility |
| `PATCH /api/oems/reorder` | Reorder OEMs |
| `DELETE /api/oems/:id` | Delete an OEM only if foreign keys permit |
| `POST /api/categories` | Create a category |
| `PATCH /api/categories/:id` | Update category fields |
| `PATCH /api/categories/:id/visibility` | Set visibility |
| `PATCH /api/categories/reorder` | Reorder categories |
| `DELETE /api/categories/:id` | Delete a category only if foreign keys permit |
| `POST /api/products` | Create a product |
| `PATCH /api/products/:id` | Update product fields |
| `PATCH /api/products/:id/visibility` | Set visibility |
| `PATCH /api/products/reorder` | Reorder products |
| `DELETE /api/products/:id` | Delete a product |

OEM creation example:

```json
{
  "id": "oem-id",
  "name": "OEM name",
  "websiteUrl": "https://example.invalid",
  "visible": true,
  "sortOrder": 0
}
```

Category creation example:

```json
{
  "id": "category-id",
  "oemId": "oem-id",
  "name": "Category name",
  "visible": true,
  "sortOrder": 0
}
```

Product creation example:

```json
{
  "id": "product-id",
  "categoryId": "category-id",
  "name": "Product name",
  "description": "Optional description",
  "applications": "Optional applications",
  "externalLink": "https://example.invalid",
  "visible": true,
  "sortOrder": 0
}
```

Visibility example:

```json
{
  "visible": false
}
```

Reorder example:

```json
{
  "items": [
    { "id": "first-record-id", "sortOrder": 0 },
    { "id": "second-record-id", "sortOrder": 1 }
  ]
}
```

Reorder items must refer to distinct records and use unique non-negative sort
orders. Categories or products in one reorder request must belong to the same
parent. OEM and category deletion is restricted by existing foreign keys; no
cascading delete is performed by these routes. Deleting a product follows its
Prisma foreign-key behavior, including deletion of related product-media links.

## Image integration requirements

This connection does not upload images or integrate Cloudflare R2. Existing
image URLs and paths are retained in catalog `sourceData`; uploaded blobs remain
in the current browser's IndexedDB and their `idb:` references are saved as
references only. Those blobs are not available to other browsers or devices.
Before enabling shared uploads, an approved integration must define the R2
bucket/account ownership, upload authorization, allowed MIME types and size
limits, public delivery URL and cache policy, replacement/deletion lifecycle,
and a migration for existing IndexedDB blobs. Until then, use existing public
asset paths or URLs for images that must be shared across visitors.
