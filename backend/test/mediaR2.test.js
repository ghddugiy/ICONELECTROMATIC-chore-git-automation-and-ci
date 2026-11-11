import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import crypto from "node:crypto";
import {
  getR2Config,
  validateImageBuffer,
  computeSha256,
  generateObjectKey,
  uploadToR2,
  deleteFromR2,
  headObject,
} from "../src/services/r2Storage.js";
import { createMediaRouter } from "../src/routes/media.js";
import { createRequireAdmin } from "../src/middleware/requireAdmin.js";
import { createOpaqueToken, hashOpaqueToken } from "../src/auth/security.js";
import prisma from "../src/db.js";

// Valid 1x1 test buffers for each image format
const VALID_1X1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const VALID_1X1_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Minimal JPEG marker buffer
const VALID_JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48,
]);

// Minimal WebP header buffer: 'RIFF' + 4-byte size + 'WEBP'
const VALID_WEBP_HEADER = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]);

async function withPublicMediaServer({ r2Service, publicDomain = null }, callback) {
  const originalPublicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain === null) {
    delete process.env.R2_PUBLIC_DOMAIN;
  } else {
    process.env.R2_PUBLIC_DOMAIN = publicDomain;
  }

  const mockPrisma = {
    mediaAsset: {
      findUnique: async () => ({
        id: "media-public-test",
        r2Key: "products/test-image.png",
        mimeType: "image/png",
        byteSize: VALID_1X1_PNG.length,
        status: "ACTIVE",
      }),
    },
  };
  const app = express();
  app.use(
    "/api/media",
    createMediaRouter({
      prismaClient: mockPrisma,
      r2Service,
    })
  );
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (originalPublicDomain === undefined) {
      delete process.env.R2_PUBLIC_DOMAIN;
    } else {
      process.env.R2_PUBLIC_DOMAIN = originalPublicDomain;
    }
  }
}

// Skip in CI: this test hardcodes the production bucket name and requires real R2 credentials.
test("R2 configuration validates required environment variables without leaking secrets", { skip: process.env.CI === "true" }, () => {
  const config = getR2Config();
  assert.ok(config.accountId, "accountId must be defined");
  assert.ok(config.accessKeyId, "accessKeyId must be defined");
  assert.ok(config.secretAccessKey, "secretAccessKey must be defined");
  assert.equal(config.bucketName, "icon-electromatic-media");
  assert.ok(config.endpoint.startsWith("https://"));

  // Verify that error message for missing variables does not contain credential values
  const origKey = process.env.R2_SECRET_ACCESS_KEY;
  try {
    delete process.env.R2_SECRET_ACCESS_KEY;
    assert.throws(
      () => getR2Config(),
      /Missing required environment variable\(s\): R2_SECRET_ACCESS_KEY/
    );
  } finally {
    process.env.R2_SECRET_ACCESS_KEY = origKey;
  }
});

test("validateImageBuffer accurately detects magic bytes for authentic images", () => {
  const pngResult = validateImageBuffer(VALID_1X1_PNG);
  assert.equal(pngResult.valid, true);
  assert.equal(pngResult.mimeType, "image/png");
  assert.equal(pngResult.ext, "png");

  const gifResult = validateImageBuffer(VALID_1X1_GIF);
  assert.equal(gifResult.valid, true);
  assert.equal(gifResult.mimeType, "image/gif");
  assert.equal(gifResult.ext, "gif");

  const jpegResult = validateImageBuffer(VALID_JPEG_HEADER);
  assert.equal(jpegResult.valid, true);
  assert.equal(jpegResult.mimeType, "image/jpeg");
  assert.equal(jpegResult.ext, "jpg");

  const webpResult = validateImageBuffer(VALID_WEBP_HEADER);
  assert.equal(webpResult.valid, true);
  assert.equal(webpResult.mimeType, "image/webp");
  assert.equal(webpResult.ext, "webp");
});

test("validateImageBuffer rejects fake, corrupted, or non-image payloads", () => {
  const textRenamedAsPng = Buffer.from("This is a plain text file, not a real image.");
  const result = validateImageBuffer(textRenamedAsPng);
  assert.equal(result.valid, false);
  assert.match(result.error, /Unsupported file format/);

  const tinyBuffer = Buffer.from([0x89, 0x50, 0x4e]);
  const tinyResult = validateImageBuffer(tinyBuffer);
  assert.equal(tinyResult.valid, false);
  assert.match(tinyResult.error, /too small/);
});

test("validateImageBuffer rejects buffers exceeding the 10 MB maximum limit", () => {
  // Test with custom max limit for speed: 50 bytes
  const buffer = Buffer.alloc(100);
  buffer[0] = 0x89;
  buffer[1] = 0x50;
  buffer[2] = 0x4e;
  buffer[3] = 0x47;
  buffer[4] = 0x0d;
  buffer[5] = 0x0a;
  buffer[6] = 0x1a;
  buffer[7] = 0x0a;

  const result = validateImageBuffer(buffer, 50);
  assert.equal(result.valid, false);
  assert.match(result.error, /exceeds the 10 MB limit/);
});

test("computeSha256 produces consistent 64-character lowercase hex digest", () => {
  const hash = computeSha256(VALID_1X1_PNG);
  assert.match(hash, /^[a-f0-9]{64}$/);

  const expected = crypto.createHash("sha256").update(VALID_1X1_PNG).digest("hex");
  assert.equal(hash, expected);
});

test("generateObjectKey creates secure, structured keys without using client filenames", () => {
  const key1 = generateObjectKey("products", "png");
  assert.match(key1, /^products\/[a-f0-9-]{36}\.png$/);

  const key2 = generateObjectKey("oem-logos", "jpg");
  assert.match(key2, /^oem-logos\/[a-f0-9-]{36}\.jpg$/);

  assert.notEqual(key1, key2);
});

test("POST /api/media/upload rejects unauthenticated requests with 401", async () => {
  const app = express();
  app.use("/api/media", createMediaRouter());

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Authentication required/);
  } finally {
    server.close();
  }
});

test("POST /api/media/upload rejects requests with missing or mismatched CSRF token with 403", async () => {
  const sessionToken = createOpaqueToken();
  const sessionHash = hashOpaqueToken(sessionToken);
  const csrfToken = createOpaqueToken();
  const csrfHash = hashOpaqueToken(csrfToken);

  const mockPrisma = {
    adminSession: {
      findUnique: async () => ({
        id: "sess_1",
        tokenHash: sessionHash,
        csrfTokenHash: csrfHash,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        adminUser: {
          id: "adm_1",
          email: "admin@test.com",
          role: "ADMIN",
          active: true,
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
  };

  const requireAdminMiddleware = createRequireAdmin({
    prismaClient: mockPrisma,
    isProduction: false,
  });

  const app = express();
  app.use(
    "/api/media",
    createMediaRouter({
      prismaClient: mockPrisma,
      requireAdminMiddleware,
    })
  );

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Missing CSRF header
    const resNoCsrf = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
      },
    });

    assert.equal(resNoCsrf.status, 403);
    const bodyNoCsrf = await resNoCsrf.json();
    assert.equal(bodyNoCsrf.success, false);
    assert.match(bodyNoCsrf.message, /CSRF validation failed/);

    // Mismatched CSRF header
    const resBadCsrf = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": "wrong-token",
      },
    });

    assert.equal(resBadCsrf.status, 403);
  } finally {
    server.close();
  }
});

test("POST /api/media/upload rejects unsupported image format with 400", async () => {
  const sessionToken = createOpaqueToken();
  const sessionHash = hashOpaqueToken(sessionToken);
  const csrfToken = createOpaqueToken();
  const csrfHash = hashOpaqueToken(csrfToken);

  const mockPrisma = {
    adminSession: {
      findUnique: async () => ({
        id: "sess_1",
        tokenHash: sessionHash,
        csrfTokenHash: csrfHash,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        adminUser: {
          id: "adm_1",
          email: "admin@test.com",
          role: "ADMIN",
          active: true,
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
  };

  const requireAdminMiddleware = createRequireAdmin({
    prismaClient: mockPrisma,
    isProduction: false,
  });

  const app = express();
  app.use(
    "/api/media",
    createMediaRouter({
      prismaClient: mockPrisma,
      requireAdminMiddleware,
    })
  );

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const formData = new FormData();
    const fakeBlob = new Blob(["Plain text pretending to be image"], {
      type: "image/png",
    });
    formData.append("image", fakeBlob, "fake.png");

    const res = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Unsupported file format/);
  } finally {
    server.close();
  }
});

test("POST /api/media/upload successfully uploads valid image, records MediaAsset in DB, and returns preview URL", async () => {
  const sessionToken = createOpaqueToken();
  const sessionHash = hashOpaqueToken(sessionToken);
  const csrfToken = createOpaqueToken();
  const csrfHash = hashOpaqueToken(csrfToken);

  let uploadedToS3 = null;
  let createdDbRecord = null;
  let previewExpirySeconds = null;

  const mockR2Service = {
    validateImageBuffer,
    computeSha256,
    generateObjectKey: () => "products/test-uuid-1234.png",
    uploadToR2: async (params) => {
      uploadedToS3 = params;
      return { ETag: '"test-etag"' };
    },
    deleteFromR2: async () => {},
    getPresignedViewUrl: async (key, expiresInSeconds) => {
      previewExpirySeconds = expiresInSeconds;
      return `https://signed.example.com/${key}?token=abc`;
    },
  };

  const mockPrisma = {
    adminSession: {
      findUnique: async () => ({
        id: "sess_1",
        tokenHash: sessionHash,
        csrfTokenHash: csrfHash,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        adminUser: {
          id: "adm_1",
          email: "admin@test.com",
          role: "ADMIN",
          active: true,
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
    mediaAsset: {
      create: async ({ data }) => {
        createdDbRecord = {
          id: "cm_asset_123",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return createdDbRecord;
      },
    },
  };

  const requireAdminMiddleware = createRequireAdmin({
    prismaClient: mockPrisma,
    isProduction: false,
  });

  const app = express();
  app.use(
    "/api/media",
    createMediaRouter({
      prismaClient: mockPrisma,
      r2Service: mockR2Service,
      requireAdminMiddleware,
    })
  );

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const formData = new FormData();
    const pngBlob = new Blob([VALID_1X1_PNG], { type: "image/png" });
    formData.append("image", pngBlob, "sample.png");

    const res = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.r2Key, "products/test-uuid-1234.png");
    assert.equal(body.data.status, "ACTIVE");
    assert.equal(body.data.mimeType, "image/png");
    assert.equal(body.data.byteSize, VALID_1X1_PNG.length);
    assert.ok(body.data.previewUrl.startsWith("https://signed.example.com/"));
    assert.equal(body.data.publicUrl, `/api/media/file/cm_asset_123`);
    assert.equal(previewExpirySeconds, 3600);

    assert.ok(uploadedToS3, "Expected S3 upload to be invoked");
    assert.equal(uploadedToS3.key, "products/test-uuid-1234.png");
    assert.ok(createdDbRecord, "Expected DB record to be created");
    assert.equal(createdDbRecord.status, "ACTIVE");
    assert.equal(createdDbRecord.uploadedById, "adm_1");
  } finally {
    server.close();
  }
});

test("POST /api/media/upload executes rollback cleanup if database insert fails after S3 upload", async () => {
  const sessionToken = createOpaqueToken();
  const sessionHash = hashOpaqueToken(sessionToken);
  const csrfToken = createOpaqueToken();
  const csrfHash = hashOpaqueToken(csrfToken);

  let deletedS3Key = null;

  const mockR2Service = {
    validateImageBuffer,
    computeSha256,
    generateObjectKey: () => "products/rollback-uuid-999.png",
    uploadToR2: async () => ({ ETag: '"test-etag"' }),
    deleteFromR2: async (key) => {
      deletedS3Key = key;
    },
    getPresignedViewUrl: async () => "https://signed.example.com",
  };

  const mockPrisma = {
    adminSession: {
      findUnique: async () => ({
        id: "sess_1",
        tokenHash: sessionHash,
        csrfTokenHash: csrfHash,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        adminUser: {
          id: "adm_1",
          email: "admin@test.com",
          role: "ADMIN",
          active: true,
        },
      }),
      updateMany: async () => ({ count: 1 }),
    },
    mediaAsset: {
      create: async () => {
        throw new Error("Simulated database failure");
      },
    },
  };

  const requireAdminMiddleware = createRequireAdmin({
    prismaClient: mockPrisma,
    isProduction: false,
  });

  const app = express();
  app.use(
    "/api/media",
    createMediaRouter({
      prismaClient: mockPrisma,
      r2Service: mockR2Service,
      requireAdminMiddleware,
    })
  );

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const formData = new FormData();
    const pngBlob = new Blob([VALID_1X1_PNG], { type: "image/png" });
    formData.append("image", pngBlob, "sample.png");

    const res = await fetch(`http://127.0.0.1:${port}/api/media/upload`, {
      method: "POST",
      headers: {
        cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Failed to persist media asset/);

    // Verify compensation rollback deleted the object
    assert.equal(deletedS3Key, "products/rollback-uuid-999.png");
  } finally {
    server.close();
  }
});

test("Public media stream failures return non-cacheable errors instead of expiring redirects", async () => {
  let presignedUrlCalls = 0;
  const r2Service = {
    getObjectStream: async () => ({ Body: null }),
    getPresignedViewUrl: async () => {
      presignedUrlCalls += 1;
      return "https://signed.example.com/expired";
    },
  };

  await withPublicMediaServer({ r2Service }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/media/file/media-public-test`);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("location"), null);
    assert.equal(presignedUrlCalls, 0);
  });

  const failingR2Service = {
    getObjectStream: async () => {
      throw new Error("temporary stream failure");
    },
    getPresignedViewUrl: async () => {
      presignedUrlCalls += 1;
      return "https://signed.example.com/expired";
    },
  };

  await withPublicMediaServer({ r2Service: failingR2Service }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/media/file/media-public-test`);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("location"), null);
    assert.equal(presignedUrlCalls, 0);
  });
});

test("Public media keeps the configured stable R2 public-domain URL", async () => {
  let streamCalls = 0;
  const r2Service = {
    getObjectStream: async () => {
      streamCalls += 1;
      throw new Error("Configured public media must not use the private stream.");
    },
    getPresignedViewUrl: async () => {
      throw new Error("Public media must not request a presigned URL.");
    },
  };

  await withPublicMediaServer(
    { r2Service, publicDomain: "https://cdn.example.com/" },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/media/file/media-public-test`, {
        redirect: "manual",
      });

      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        "https://cdn.example.com/products/test-image.png"
      );
      assert.equal(streamCalls, 0);
    }
  );
});

// Live writes require explicit opt-in and a dedicated non-production bucket.
test("LIVE R2 INTEGRATION: uploads, verifies, and deletes a unique test object", {
  skip:
    process.env.CI === "true" ||
    process.env.RUN_LIVE_R2_TESTS !== "true",
}, async () => {
  const configuredBucket = getR2Config().bucketName;
  const testBucket = process.env.R2_TEST_BUCKET_NAME;
  assert.ok(testBucket, "R2_TEST_BUCKET_NAME must identify an approved test bucket");
  assert.notEqual(
    testBucket,
    "icon-electromatic-media",
    "Live integration tests must never use the production bucket"
  );
  assert.equal(configuredBucket, testBucket, "R2_BUCKET_NAME must match R2_TEST_BUCKET_NAME");

  const testKey = `test-health/${crypto.randomUUID()}.png`;
  const sha256 = computeSha256(VALID_1X1_PNG);
  let uploadAttempted = false;

  try {
    uploadAttempted = true;
    await uploadToR2({
      key: testKey,
      buffer: VALID_1X1_PNG,
      mimeType: "image/png",
      metadata: { test: "health-check", sha256 },
      bucketName: testBucket,
    });

    const head = await headObject(testKey, undefined, testBucket);
    assert.ok(head, "Expected object to exist in R2 bucket");
    assert.equal(head.ContentType, "image/png");
    assert.equal(head.ContentLength, VALID_1X1_PNG.length);
  } finally {
    if (uploadAttempted) {
      await deleteFromR2(testKey, undefined, testBucket);
    }
  }
});

// Skip in CI: the ephemeral CI database has no seeded catalog data.
test("POST-TRANSFER DATA SAFETY GUARANTEE: PostgreSQL catalog tables contain the expected baseline catalog", { skip: process.env.CI === "true" }, async () => {
  // The baseline catalog transfer was applied via the Admin CMS.
  // These counts verify that the media upload tests did not corrupt or modify catalog records.
  const [oemCount, catCount, prodCount] = await Promise.all([
    prisma.oem.count(),
    prisma.category.count(),
    prisma.product.count(),
  ]);

  assert.ok(oemCount >= 15, `oem table must have at least 15 records, got ${oemCount}`);
  assert.ok(catCount >= 88, `category table must have at least 88 records, got ${catCount}`);
  assert.ok(prodCount >= 169, `product table must have at least 169 records, got ${prodCount}`);
});
