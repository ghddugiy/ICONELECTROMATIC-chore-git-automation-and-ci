import { Router } from "express";
import multer from "multer";
import prisma from "../db.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  computeSha256,
  deleteFromR2,
  generateObjectKey,
  getObjectStream,
  getPresignedViewUrl,
  uploadToR2,
  validateImageBuffer,
} from "../services/r2Storage.js";

const defaultR2Service = {
  computeSha256,
  deleteFromR2,
  generateObjectKey,
  getObjectStream,
  getPresignedViewUrl,
  uploadToR2,
  validateImageBuffer,
};

// Configure Multer with memory storage and 10 MB maximum size
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

/**
 * Middleware wrapper for Multer to catch file size limits and formatting errors.
 */
function uploadMiddleware(req, res, next) {
  const uploadHandler = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]);

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "File size exceeds the 10 MB maximum limit.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed.",
      });
    }

    next();
  });
}

/**
 * Factory function for the media router to facilitate unit and integration testing.
 */
export function createMediaRouter({
  prismaClient = prisma,
  r2Service = defaultR2Service,
  requireAdminMiddleware = requireAdmin,
} = {}) {
  const router = Router();

  /**
   * POST /api/media/upload
   * Authenticated admin endpoint for uploading images to Cloudflare R2 and creating a MediaAsset.
   */
  router.post("/upload", requireAdminMiddleware, uploadMiddleware, async (req, res) => {
    const uploadedFile =
      req.files?.image?.[0] || req.files?.file?.[0] || req.file;

    if (!uploadedFile || !uploadedFile.buffer) {
      return res.status(400).json({
        success: false,
        message:
          "No image file provided. Please attach an image in the 'image' or 'file' form field.",
      });
    }

    // Validate actual binary contents via magic bytes and size check
    const validation = r2Service.validateImageBuffer(
      uploadedFile.buffer,
      10 * 1024 * 1024
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const sha256 = r2Service.computeSha256(uploadedFile.buffer);
    const folder =
      typeof req.body?.folder === "string" &&
      ["oem-logos", "banners", "diagrams", "products"].includes(req.body.folder)
        ? req.body.folder
        : "products";

    const objectKey = r2Service.generateObjectKey(folder, validation.ext);

    // 1. Upload to Cloudflare R2
    try {
      await r2Service.uploadToR2({
        key: objectKey,
        buffer: uploadedFile.buffer,
        mimeType: validation.mimeType,
        metadata: {
          sha256,
          uploadedBy: req.adminUser?.id || "unknown",
        },
      });
    } catch (r2Error) {
      console.error("R2 upload error:", r2Error.message);
      return res.status(502).json({
        success: false,
        message: "Cloudflare R2 storage upload failed.",
      });
    }

    // 2. Persist MediaAsset in PostgreSQL with rollback safety
    let mediaAsset;
    try {
      mediaAsset = await prismaClient.mediaAsset.create({
        data: {
          r2Key: objectKey,
          mimeType: validation.mimeType,
          byteSize: BigInt(uploadedFile.buffer.length),
          sha256,
          status: "ACTIVE",
          uploadedById: req.adminUser?.id || null,
          sourcePath: uploadedFile.originalname
            ? String(uploadedFile.originalname).slice(0, 500)
            : null,
        },
      });
    } catch (dbError) {
      console.error(
        "Database insert failed after R2 upload; triggering rollback cleanup:",
        dbError.message
      );

      // Rollback compensation: delete newly uploaded object from R2 to prevent orphans
      try {
        await r2Service.deleteFromR2(objectKey);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up orphaned R2 object:",
          cleanupError.message
        );
      }

      return res.status(500).json({
        success: false,
        message: "Failed to persist media asset record in the database.",
      });
    }

    // 3. Generate short-lived presigned URL for immediate admin preview
    let previewUrl = null;
    try {
      previewUrl = await r2Service.getPresignedViewUrl(objectKey, 3600);
    } catch (signError) {
      console.error(
        "Failed to generate presigned preview URL:",
        signError.message
      );
    }

    return res.status(201).json({
      success: true,
      message: "Image uploaded and stored successfully in Cloudflare R2.",
      data: {
        id: mediaAsset.id,
        r2Key: mediaAsset.r2Key,
        mimeType: mediaAsset.mimeType,
        byteSize: Number(mediaAsset.byteSize),
        sha256: mediaAsset.sha256,
        status: mediaAsset.status,
        previewUrl,
        publicUrl: `/api/media/file/${mediaAsset.id}`,
      },
    });
  });

  /**
   * GET /api/media/file/:id
   * Public delivery route for published product and website images.
   * Does not require admin authentication.
   */
  router.get("/file/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const asset = await prismaClient.mediaAsset.findUnique({
        where: { id },
        select: {
          id: true,
          r2Key: true,
          mimeType: true,
          byteSize: true,
          status: true,
        },
      });

      if (!asset || asset.status !== "ACTIVE" || !asset.r2Key) {
        return res.status(404).json({
          success: false,
          message: "Media asset not found or not active.",
        });
      }

      // If an explicit public CDN domain is configured (e.g. media.iconelectromatic.com)
      if (process.env.R2_PUBLIC_DOMAIN) {
        const publicBase = process.env.R2_PUBLIC_DOMAIN.replace(/\/+$/, "");
        return res.redirect(302, `${publicBase}/${asset.r2Key}`);
      }

      // Stream directly from private R2 bucket with strong caching headers
      try {
        const s3Response = await r2Service.getObjectStream(asset.r2Key);
        res.setHeader("Content-Type", asset.mimeType || "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
        if (asset.byteSize) {
          res.setHeader("Content-Length", asset.byteSize.toString());
        }

        if (s3Response.Body && typeof s3Response.Body.pipe === "function") {
          return s3Response.Body.pipe(res);
        } else {
          const presigned = await r2Service.getPresignedViewUrl(asset.r2Key, 900);
          return res.redirect(302, presigned);
        }
      } catch (streamError) {
        // Fallback: generate a short-lived presigned URL and redirect
        const presigned = await r2Service.getPresignedViewUrl(asset.r2Key, 900);
        return res.redirect(302, presigned);
      }
    } catch (error) {
      console.error("Error retrieving media file:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error retrieving media file.",
      });
    }
  });

  /**
   * GET /api/media/:id
   * Authenticated admin endpoint for inspecting media metadata and obtaining a fresh presigned URL.
   */
  router.get("/:id", requireAdminMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
      const asset = await prismaClient.mediaAsset.findUnique({
        where: { id },
        include: {
          uploadedBy: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!asset) {
        return res.status(404).json({
          success: false,
          message: "Media asset not found.",
        });
      }

      let presignedUrl = null;
      if (asset.r2Key) {
        try {
          presignedUrl = await r2Service.getPresignedViewUrl(asset.r2Key, 3600);
        } catch (err) {
          console.error("Presigned URL generation error:", err.message);
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          id: asset.id,
          r2Key: asset.r2Key,
          mimeType: asset.mimeType,
          byteSize: Number(asset.byteSize),
          sha256: asset.sha256,
          status: asset.status,
          sourcePath: asset.sourcePath,
          presignedUrl,
          publicUrl: `/api/media/file/${asset.id}`,
          uploadedBy: asset.uploadedBy,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error fetching media metadata:", error.message);
      return res.status(500).json({
        success: false,
        message: "Internal server error fetching media metadata.",
      });
    }
  });

  return router;
}

export default createMediaRouter();
