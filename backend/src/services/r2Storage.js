import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

/**
 * Validates the presence of required Cloudflare R2 environment variables.
 * Never prints or leaks secret values.
 */
export function getR2Config() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_ENDPOINT,
    R2_PUBLIC_DOMAIN,
  } = process.env;

  const missing = [];
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
  if (!R2_ENDPOINT) missing.push("R2_ENDPOINT");

  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 configuration error: Missing required environment variable(s): ${missing.join(
        ", "
      )}`
    );
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucketName: R2_BUCKET_NAME,
    endpoint: R2_ENDPOINT,
    publicDomain: R2_PUBLIC_DOMAIN || null,
  };
}

let cachedS3Client = null;

/**
 * Creates or returns the singleton S3 client for Cloudflare R2.
 */
export function getS3Client() {
  if (cachedS3Client) return cachedS3Client;

  const config = getR2Config();
  cachedS3Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedS3Client;
}

/**
 * Inspects buffer magic bytes to accurately detect real image type.
 * Supports JPEG, PNG, WebP, GIF.
 * Enforces maximum size limit (default 10 MB).
 */
export function validateImageBuffer(buffer, maxSizeBytes = 10 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer)) {
    return { valid: false, error: "Image payload must be a binary buffer." };
  }

  if (buffer.length < 12) {
    return {
      valid: false,
      error: "File is too small to be a valid image or is corrupted.",
    };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(
        2
      )} MB) exceeds the 10 MB limit.`,
    };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg", ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png", ext: "png" };
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp", ext: "webp" };
  }

  // GIF: GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { valid: true, mimeType: "image/gif", ext: "gif" };
  }

  return {
    valid: false,
    error:
      "Unsupported file format. Only authentic JPEG, PNG, WebP, and GIF images are permitted.",
  };
}

/**
 * Computes SHA-256 hex digest of a buffer.
 */
export function computeSha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generates a unique, non-enumerable object key.
 * Never uses raw client filenames directly.
 */
export function generateObjectKey(folder = "products", ext = "jpg") {
  const safeExt = ext.replace(/^\./, "").toLowerCase();
  const uniqueId = crypto.randomUUID();
  return `${folder}/${uniqueId}.${safeExt}`;
}

/**
 * Uploads a validated image buffer to Cloudflare R2.
 */
export async function uploadToR2({
  key,
  buffer,
  mimeType,
  metadata = {},
  client = getS3Client(),
  bucketName = getR2Config().bucketName,
}) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
  });

  return await client.send(command);
}

/**
 * Deletes an object from Cloudflare R2.
 * Used for rollback cleanup if subsequent operations fail.
 */
export async function deleteFromR2(
  key,
  client = getS3Client(),
  bucketName = getR2Config().bucketName
) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await client.send(command);
}

/**
 * Generates a short-lived presigned GET URL for authorized viewing.
 * Defaults to 1 hour (3600 seconds).
 */
export async function getPresignedViewUrl(
  key,
  expiresInSeconds = 3600,
  client = getS3Client(),
  bucketName = getR2Config().bucketName
) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Retrieves the object stream from Cloudflare R2.
 */
export async function getObjectStream(
  key,
  client = getS3Client(),
  bucketName = getR2Config().bucketName
) {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await client.send(command);
}

/**
 * Checks whether an object exists in Cloudflare R2.
 */
export async function headObject(
  key,
  client = getS3Client(),
  bucketName = getR2Config().bucketName
) {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await client.send(command);
}
