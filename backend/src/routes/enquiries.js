/**
 * enquiries.js — Contact / RFQ and Career Application submission routes.
 *
 * POST /api/enquiries/contact  — Technical & RFQ enquiry form
 * POST /api/enquiries/careers  — Engineering careers application (multipart)
 *
 * Security measures:
 *   - Per-IP rate limiting (enquiryRateLimit middleware)
 *   - Honeypot field: reject silently if `website` field is present (bot trap)
 *   - Server-side validation of all fields; browser validation alone is not trusted
 *   - Email format validated with a strict regex (no external library needed)
 *   - Resume file type validated by allowed MIME types and extension allowlist
 *   - IP addresses stored only for abuse investigation; never exposed in responses
 *   - Stack traces and internal errors never returned to the client
 */

import { Router } from "express";
import multer from "multer";
import prisma from "../db.js";
import {
  sendEnquiryEmail,
  sendCareerEmail,
  sendAcknowledgementEmail,
  formatEnquiryReference,
  resolveRecipientEmail,
} from "../services/emailService.js";
import { asyncHandler } from "../routes/common.js";
import enquiryRateLimitDefault, {
  createEnquiryRateLimit,
} from "../middleware/enquiryRateLimit.js";

// ─── Validation helpers ───────────────────────────────────────────────────────

const ALLOWED_SUBJECT_TYPES = new Set([
  "rfq",
  "technical",
  "bespoke",
  "delivery",
  "general",
]);

const ALLOWED_REGIONS = new Map([
  ["india", "INDIA"],
  ["singapore", "SINGAPORE"],
  ["usa", "USA"],
]);

// RFC 5322-simplified email pattern — rejects the most obvious malformed addresses
// without importing a library. Not exhaustive by design (edge-case addresses are rare
// in a B2B context and Resend will reject truly invalid ones on delivery).
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// URL pattern for optional LinkedIn field
const URL_RE = /^https?:\/\/.{3,}/;

const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_RESUME_EXT = new Set(["pdf", "doc", "docx"]);
const RESUME_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Trim a value and return it, or null if empty/missing.
 */
function clean(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Collect all field-level errors into an array.
 * Returns an empty array when validation passes.
 */
function validateEnquiry(body) {
  const errors = [];

  const fullname = clean(body.fullname);
  if (!fullname || fullname.length > 100) {
    errors.push("fullname must be between 1 and 100 characters.");
  }

  const company = clean(body.company);
  if (!company || company.length > 100) {
    errors.push("company must be between 1 and 100 characters.");
  }

  const email = clean(body.email);
  if (!email || !EMAIL_RE.test(email)) {
    errors.push("email must be a valid email address.");
  }

  const phone = clean(body.phone);
  if (!phone || phone.length < 6 || phone.length > 30) {
    errors.push("phone must be between 6 and 30 characters.");
  }

  const type = clean(body.subject) || clean(body.type);
  if (!type || !ALLOWED_SUBJECT_TYPES.has(type)) {
    errors.push(
      `subject must be one of: ${[...ALLOWED_SUBJECT_TYPES].join(", ")}.`
    );
  }

  const model = clean(body.model);
  if (model && model.length > 200) {
    errors.push("model must be at most 200 characters.");
  }

  const message = clean(body.message);
  if (!message || message.length < 10 || message.length > 2000) {
    errors.push("message must be between 10 and 2000 characters.");
  }

  let region = null;
  const rawRegion = clean(body.region);
  if (rawRegion) {
    const canonical = ALLOWED_REGIONS.get(rawRegion.toLowerCase());
    if (!canonical) {
      errors.push("region must be one of: india, singapore, usa.");
    } else {
      region = canonical;
    }
  }

  return { errors, fullname, company, email, phone, type, model, message, region };
}

function validateCareerFields(body) {
  const errors = [];

  const fullname = clean(body.fullname);
  if (!fullname || fullname.length > 100) {
    errors.push("fullname must be between 1 and 100 characters.");
  }

  const email = clean(body.email);
  if (!email || !EMAIL_RE.test(email)) {
    errors.push("email must be a valid email address.");
  }

  const position = clean(body.position);
  if (!position || position.length > 150) {
    errors.push("position must be between 1 and 150 characters.");
  }

  const phone = clean(body.phone);
  if (!phone || phone.length < 6 || phone.length > 30) {
    errors.push("phone must be between 6 and 30 characters.");
  }

  const city = clean(body.city);
  if (!city || city.length > 100) {
    errors.push("city must be between 1 and 100 characters.");
  }

  const experience = clean(body.experience);
  if (!experience || experience.length > 100) {
    errors.push("experience must be between 1 and 100 characters.");
  }

  const organization = clean(body.organization);
  if (!organization || organization.length > 150) {
    errors.push("organization must be between 1 and 150 characters.");
  }

  const notice = clean(body.notice);
  if (!notice || notice.length > 100) {
    errors.push("notice must be between 1 and 100 characters.");
  }

  const skills = clean(body.skills);
  if (!skills || skills.length > 500) {
    errors.push("skills must be between 1 and 500 characters.");
  }

  const linkedin = clean(body.linkedin);
  if (linkedin && (!URL_RE.test(linkedin) || linkedin.length > 300)) {
    errors.push("linkedin must be a valid URL starting with http:// or https://");
  }

  const statement = clean(body.statement);
  if (!statement || statement.length < 20 || statement.length > 3000) {
    errors.push("statement must be between 20 and 3000 characters.");
  }

  return {
    errors,
    fullname,
    email,
    position,
    phone,
    city,
    experience,
    organization,
    notice,
    skills,
    linkedin: linkedin || null,
    statement,
  };
}

function validateResume(file) {
  if (!file) return null; // resume optional at field level — enforced below if required
  const errors = [];
  if (file.size > RESUME_MAX_BYTES) {
    errors.push(
      `Resume file exceeds the 10 MB limit (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }
  const ext = (file.originalname || "").split(".").pop().toLowerCase();
  if (!ALLOWED_RESUME_EXT.has(ext) || !ALLOWED_RESUME_MIME.has(file.mimetype)) {
    errors.push("Resume must be a PDF, DOC, or DOCX file.");
  }
  return errors;
}

// ─── Router factory (injectable for tests) ────────────────────────────────────

export function createEnquiriesRouter({
  prismaClient = prisma,
  emailSendEnquiry = sendEnquiryEmail,
  emailSendCareer = sendCareerEmail,
  emailSendAcknowledgement = sendAcknowledgementEmail,
  rateLimitMiddleware = enquiryRateLimitDefault,
} = {}) {
  const router = Router();

  // Multer configured for memory storage; file type is re-validated server-side.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: RESUME_MAX_BYTES + 1024 }, // slight slack so multer won't reject before our message
  });

  // ── POST /api/enquiries/contact ─────────────────────────────────────────────
  router.post(
    "/contact",
    rateLimitMiddleware,
    asyncHandler(async (req, res) => {
      // Honeypot: bots fill in the hidden `website` field; humans leave it empty.
      if (clean(req.body.website)) {
        // Silent 200 — do not reveal to bots that they were detected.
        return res.status(200).json({ success: true, id: "honeypot" });
      }

      const { errors, fullname, company, email, phone, type, model, message, region } =
        validateEnquiry(req.body);

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors[0] });
      }

      const ip = req.socket?.remoteAddress || null;

      // Persist before attempting email so we have a record even if email fails.
      const record = await prismaClient.enquiry.create({
        data: { fullname, company, email, phone, type, model, message, region, ip },
      });

      const emailResult = await emailSendEnquiry(record);

      // Update status based on email outcome.
      await prismaClient.enquiry.update({
        where: { id: record.id },
        data: {
          status: emailResult.ok ? "EMAILED" : "EMAIL_FAILED",
          emailError: emailResult.ok ? null : emailResult.error,
        },
      });

      const refCode = formatEnquiryReference(record.id);
      const targetInbox = resolveRecipientEmail(
        record.region,
        process.env.CONTACT_EMAIL || "salesiepl@iconelectromatic.com"
      );

      // Log internal regional sales notification communication record (for both success and failure)
      if (prismaClient.enquiryCommunication?.create) {
        try {
          await prismaClient.enquiryCommunication.create({
            data: {
              enquiryId: record.id,
              type: "EMAIL_OUTBOUND",
              subject: emailResult.ok
                ? `Internal Sales Notification Dispatched [Ref: #${refCode}]`
                : `Internal Sales Notification Failed [Ref: #${refCode}]`,
              body: emailResult.ok
                ? `Internal regional sales notification successfully dispatched to ${targetInbox}.`
                : `Internal regional sales notification failed to dispatch to ${targetInbox}: ${emailResult.error || "Delivery error"}`,
              metadata: {
                channel: "INTERNAL_SALES_NOTIFICATION",
                recipient: targetInbox,
                resendMessageId: emailResult.id || null,
                deliveryStatus: emailResult.ok ? "SENT" : "FAILED",
                error: emailResult.ok ? null : emailResult.error,
              },
              authorId: null,
            },
          });
        } catch (commErr) {
          console.error(
            "[enquiries] Failed to log internal sales communication audit record:",
            commErr.message || commErr
          );
        }
      }

      if (!emailResult.ok) {
        // The submission is safely saved in PostgreSQL; inform user of internal dispatch issue.
        // Internal sales notification failed: do not send customer acknowledgement.
        return res.status(502).json({
          success: false,
          message:
            "Your enquiry was received but could not be dispatched to our team automatically. Please contact us directly if urgent.",
        });
      }

      // Check existing communication history before sending an acknowledgement for an enquiry (Duplicate protection).
      // Note: Must distinguish CUSTOMER_ACKNOWLEDGEMENT from INTERNAL_SALES_NOTIFICATION using metadata.channel!
      let existingAck = null;
      if (prismaClient.enquiryCommunication?.findMany) {
        const existingOutbounds = await prismaClient.enquiryCommunication.findMany({
          where: {
            enquiryId: record.id,
            type: "EMAIL_OUTBOUND",
          },
        });
        existingAck = existingOutbounds.find(
          (c) => c.metadata && c.metadata.channel === "CUSTOMER_ACKNOWLEDGEMENT"
        );
      } else if (prismaClient.enquiryCommunication?.findFirst) {
        const firstOutbound = await prismaClient.enquiryCommunication.findFirst({
          where: {
            enquiryId: record.id,
            type: "EMAIL_OUTBOUND",
          },
        });
        if (firstOutbound && firstOutbound.metadata?.channel === "CUSTOMER_ACKNOWLEDGEMENT") {
          existingAck = firstOutbound;
        }
      }

      if (!existingAck) {
        const ackResult = await emailSendAcknowledgement(record);

        if (prismaClient.enquiryCommunication?.create) {
          await prismaClient.enquiryCommunication.create({
            data: {
              enquiryId: record.id,
              type: "EMAIL_OUTBOUND",
              subject: `Enquiry Received [Ref: #${refCode}] — ICON Electromatic`,
              body: `Automated customer acknowledgement email dispatched to ${record.email}.`,
              metadata: {
                channel: "CUSTOMER_ACKNOWLEDGEMENT",
                recipient: record.email,
                resendMessageId: ackResult.id || null,
                deliveryStatus: ackResult.ok ? "SENT" : "FAILED",
                error: ackResult.ok ? null : ackResult.error,
              },
              authorId: null,
            },
          });
        }
      }

      return res.status(201).json({ success: true, id: record.id });
    })
  );

  // ── POST /api/enquiries/careers ─────────────────────────────────────────────
  router.post(
    "/careers",
    rateLimitMiddleware,
    upload.single("resume"),
    asyncHandler(async (req, res) => {
      // Honeypot check on multipart body
      if (clean(req.body.website)) {
        return res.status(200).json({ success: true, id: "honeypot" });
      }

      // Text-field validation
      const {
        errors: fieldErrors,
        fullname,
        email,
        position,
        phone,
        city,
        experience,
        organization,
        notice,
        skills,
        linkedin,
        statement,
      } = validateCareerFields(req.body);

      // Resume validation
      const resumeFile = req.file || null;
      const resumeErrors = resumeFile ? validateResume(resumeFile) : [];

      if (!resumeFile) {
        resumeErrors.push("A resume file (PDF, DOC, or DOCX) is required.");
      }

      const allErrors = [...fieldErrors, ...resumeErrors];
      if (allErrors.length > 0) {
        return res.status(400).json({ success: false, message: allErrors[0] });
      }

      const ip = req.socket?.remoteAddress || null;
      const resumeName = resumeFile.originalname;
      const resumeSizeKb = Math.ceil(resumeFile.size / 1024);

      // Persist text fields only — resume binary is never stored in DB.
      const record = await prismaClient.careerApplication.create({
        data: {
          fullname,
          email,
          position,
          phone,
          city,
          experience,
          organization,
          notice,
          skills,
          linkedin,
          statement,
          resumeName,
          resumeSizeKb,
          ip,
        },
      });

      const emailResult = await emailSendCareer(
        record,
        resumeFile.buffer,
        resumeName,
        resumeFile.mimetype
      );

      await prismaClient.careerApplication.update({
        where: { id: record.id },
        data: {
          status: emailResult.ok ? "EMAILED" : "EMAIL_FAILED",
          emailError: emailResult.ok ? null : emailResult.error,
        },
      });

      if (!emailResult.ok) {
        return res.status(502).json({
          success: false,
          message:
            "Your application was received but could not be dispatched to our team automatically. Please email your CV directly to our careers address.",
        });
      }

      return res.status(201).json({ success: true, id: record.id });
    })
  );

  return router;
}

export default createEnquiriesRouter();
