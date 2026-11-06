/**
 * emailService.js — Resend-backed email delivery for enquiries and career applications.
 *
 * Requirements:
 *   - Primary sender variable: RESEND_FROM_EMAIL
 *   - Backward-compatible fallback: ENQUIRY_FROM (logs a warning in production)
 *   - Destination inbox: CONTACT_EMAIL
 *   - API Key: RESEND_API_KEY
 *   - No hardcoded secrets, no production fallback to onboarding@resend.dev
 *   - Explicit server configuration error when any required variable is missing
 */

import { Resend } from "resend";

/**
 * Resolve current email configuration dynamically from environment variables.
 * Allows runtime testing and prevents static module-load caching.
 */
export function getEmailConfig() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const contactEmail = (process.env.CONTACT_EMAIL || "").trim();
  const isProduction = process.env.NODE_ENV === "production";

  let fromEmail = (process.env.RESEND_FROM_EMAIL || "").trim();

  // Backward compatibility: support legacy ENQUIRY_FROM if RESEND_FROM_EMAIL is not set
  if (!fromEmail && process.env.ENQUIRY_FROM) {
    fromEmail = process.env.ENQUIRY_FROM.trim();
    if (isProduction && fromEmail) {
      console.warn(
        "[emailService] Warning: Using legacy ENQUIRY_FROM. Please configure RESEND_FROM_EMAIL for production."
      );
    }
  }

  // Never use onboarding@resend.dev as a production fallback
  if (!fromEmail && !isProduction && apiKey) {
    // Development convenience only when explicitly testing with a dev key
    fromEmail = "onboarding@resend.dev";
  }

  const missing = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!fromEmail) missing.push("RESEND_FROM_EMAIL");
  if (!contactEmail) missing.push("CONTACT_EMAIL");

  return {
    apiKey,
    fromEmail,
    contactEmail,
    isConfigured: missing.length === 0,
    missing,
  };
}

let _resendClient = null;
let _cachedApiKey = null;

/**
 * Get or initialize the Resend client.
 */
export function getResendClient(apiKey) {
  const key = apiKey || getEmailConfig().apiKey;
  if (!key) return null;
  if (!_resendClient || _cachedApiKey !== key) {
    _resendClient = new Resend(key);
    _cachedApiKey = key;
  }
  return _resendClient;
}

/**
 * Designated regional office recipient addresses.
 * Server-side authoritative mapping; never trusts client-supplied recipient addresses.
 */
export const REGIONAL_CONTACT_EMAILS = Object.freeze({
  INDIA: "salesiepl@iconelectromatic.com",
  SINGAPORE: "IESing@iconelectromatic.com",
  USA: "salesiellc@iconelectromatic.com",
});

export const REGIONAL_LABELS = Object.freeze({
  INDIA: "India HQ (Bengaluru)",
  SINGAPORE: "Singapore Liaison Office",
  USA: "USA Liaison Office",
});

/**
 * Resolve the recipient email address based on enquiry region.
 * Defaults safely to fallbackEmail (config.contactEmail) if region is omitted,
 * null, empty, whitespace-only, or unrecognized.
 *
 * @param {string|null} region - e.g. "INDIA", "SINGAPORE", "USA"
 * @param {string} fallbackEmail - primary fallback inbox (e.g. config.contactEmail)
 * @returns {string} resolved destination email
 */
export function resolveRecipientEmail(region, fallbackEmail) {
  if (!region || typeof region !== "string") {
    return fallbackEmail;
  }
  const key = region.trim().toUpperCase();
  return REGIONAL_CONTACT_EMAILS[key] || fallbackEmail;
}

/**
 * Escape plain-text content for inclusion in an HTML email.
 * Escapes characters meaningful inside HTML text nodes.
 */
export function esc(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

/**
 * Format a clean, human-friendly enquiry reference.
 * e.g. "IE-1234ABCD" using the last 8 characters of enquiry.id, or full ID if shorter.
 */
export function formatEnquiryReference(id) {
  if (!id || typeof id !== "string") return "IE-ENQUIRY";
  const suffix = id.length > 8 ? id.slice(-8) : id;
  return `IE-${suffix.toUpperCase()}`;
}

/**
 * Build the HTML body for a contact / RFQ enquiry email.
 * @param {object} e - validated enquiry fields
 */
export function buildEnquiryHtml(e) {
  const subjectLabels = {
    rfq: "Formal Request for Quotation (RFQ)",
    technical: "Technical Support & Specifications",
    bespoke: "Bespoke RF Component Engineering",
    delivery: "Lead Time & Logistics Verification",
    general: "General Corporate Inquiry",
  };
  const subjectLabel = subjectLabels[e.type] || e.type || "General Inquiry";
  const normalizedRegion = e.region && typeof e.region === "string" ? e.region.trim().toUpperCase() : null;
  const regionLabel = normalizedRegion ? (REGIONAL_LABELS[normalizedRegion] || normalizedRegion) : null;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New Enquiry — ICON Electromatic</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#1e3a5f;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">New Customer Enquiry — Technical Dispatch</h2>
      <p style="color:#a0b4c8;margin:4px 0 0;font-size:13px;">Received via iconelectromatic.com/contact</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:36%;vertical-align:top;"><strong>Name</strong></td><td style="padding:8px 0;">${esc(e.fullname)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Company</strong></td><td style="padding:8px 0;">${esc(e.company)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Email</strong></td><td style="padding:8px 0;"><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Phone</strong></td><td style="padding:8px 0;">${esc(e.phone)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Subject</strong></td><td style="padding:8px 0;">${esc(subjectLabel)}</td></tr>
        ${regionLabel ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Target Office</strong></td><td style="padding:8px 0;">${esc(regionLabel)}</td></tr>` : ""}
        ${e.model ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Product / Model</strong></td><td style="padding:8px 0;">${esc(e.model)}</td></tr>` : ""}
      </table>
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:16px 0;">
      <p style="color:#333;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(e.message)}</p>
    </div>
    <div style="background:#f9f9f9;padding:12px 24px;font-size:12px;color:#999;border-top:1px solid #e8e8e8;">
      This message was submitted through the ICON Electromatic website contact form.
      Reply directly to this email to respond to the enquirer.
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Build the HTML body for a career application email.
 * Resume binary is included as an attachment — not referenced here.
 * @param {object} a - validated career application fields
 */
export function buildCareerHtml(a) {
  const rows = [
    ["Name", a.fullname],
    ["Email", a.email],
    ["Phone", a.phone],
    ["Position Applied", a.position],
    ["Current City", a.city],
    ["Experience", a.experience],
    ["Current Organisation", a.organization],
    ["Notice Period", a.notice],
    ["Technical Skills", a.skills],
    ["LinkedIn", a.linkedin || "Not provided"],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#666;width:36%;vertical-align:top;"><strong>${label}</strong></td><td style="padding:8px 0;">${esc(String(value))}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New Career Application — ICON Electromatic</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#1e3a5f;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">New Career Application — Engineering Recruitment</h2>
      <p style="color:#a0b4c8;margin:4px 0 0;font-size:13px;">Received via iconelectromatic.com/contact (Careers tab)</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>
      <hr style="border:none;border-top:1px solid #e8e8e8;margin:16px 0;">
      <p style="color:#555;font-size:13px;font-weight:600;margin-bottom:4px;">Candidate Statement:</p>
      <p style="color:#333;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(a.statement)}</p>
      ${a.resumeName ? `<p style="font-size:12px;color:#999;margin-top:16px;">Attachment: ${esc(a.resumeName)} (${a.resumeSizeKb} KB)</p>` : ""}
    </div>
    <div style="background:#f9f9f9;padding:12px 24px;font-size:12px;color:#999;border-top:1px solid #e8e8e8;">
      This application was submitted through the ICON Electromatic careers form.
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Build the HTML body for a customer acknowledgement email.
 * This email confirms receipt of the enquiry to the customer.
 *
 * STRICT SECURITY REQUIREMENT:
 * Internal regional sales recipient addresses (salesiepl@..., IESing@..., salesiellc@...)
 * must NEVER appear anywhere in this email body or headers.
 *
 * @param {object} e - validated enquiry fields
 */
export function buildAcknowledgementHtml(e) {
  const subjectLabels = {
    rfq: "Formal Request for Quotation (RFQ)",
    technical: "Technical Support & Specifications",
    bespoke: "Bespoke RF Component Engineering",
    delivery: "Lead Time & Logistics Verification",
    general: "General Corporate Inquiry",
  };
  const subjectLabel = subjectLabels[e.type] || e.type || "General Inquiry";
  const normalizedRegion =
    e.region && typeof e.region === "string" ? e.region.trim().toUpperCase() : null;
  const regionLabel = normalizedRegion
    ? REGIONAL_LABELS[normalizedRegion] || normalizedRegion
    : null;
  const refCode = formatEnquiryReference(e.id);

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Enquiry Received — ICON Electromatic</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;margin:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#1e3a5f;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;font-weight:700;">ICON Electromatic</h2>
      <p style="color:#a0b4c8;margin:4px 0 0;font-size:13px;">Technical Dispatch &amp; Applications Support</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#333;font-size:15px;margin:0 0 16px;line-height:1.5;">Dear ${esc(e.fullname)},</p>
      <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Thank you for contacting ICON Electromatic. We have successfully received your enquiry. Our application engineering team has been notified and is currently reviewing your specifications.
      </p>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:0 0 20px;">
        <h4 style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;color:#1e3a5f;">Enquiry Summary</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:6px 0;color:#64748b;width:38%;vertical-align:top;"><strong>Reference:</strong></td><td style="padding:6px 0;color:#0f172a;font-weight:600;">#${esc(refCode)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;"><strong>Organization:</strong></td><td style="padding:6px 0;color:#0f172a;">${esc(e.company)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;"><strong>Subject:</strong></td><td style="padding:6px 0;color:#0f172a;">${esc(subjectLabel)}</td></tr>
          ${regionLabel ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top;"><strong>Target Office:</strong></td><td style="padding:6px 0;color:#0f172a;">${esc(regionLabel)}</td></tr>` : ""}
          ${e.model ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top;"><strong>Target Model / Band:</strong></td><td style="padding:6px 0;color:#0f172a;">${esc(e.model)}</td></tr>` : ""}
        </table>
      </div>

      <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 12px;">
        A technical representative will respond to your requirement within 24 business hours.
      </p>

      <div style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e8e8e8;">
        <p style="color:#64748b;font-size:12px;font-weight:600;margin:0 0 6px;">Your Submitted Requirement:</p>
        <div style="background:#f9fafb;border-left:3px solid #1e3a5f;padding:10px 14px;font-size:13px;color:#334155;line-height:1.6;white-space:pre-wrap;">${esc(e.message)}</div>
      </div>
    </div>
    <div style="background:#f9f9f9;padding:14px 24px;font-size:12px;color:#64748b;border-top:1px solid #e8e8e8;line-height:1.5;">
      Icon Electromatic Pvt. Ltd. | Bengaluru &bull; Singapore &bull; United States<br>
      This is an automated confirmation of receipt. If you have urgent technical inquiries, please visit <a href="https://iconelectromatic.com" style="color:#1e3a5f;text-decoration:none;">iconelectromatic.com</a>.
    </div>
  </div>
</body>
</html>`.trim();
}

/**
 * Send a contact / RFQ enquiry email.
 * @param {object} enquiry - validated enquiry record
 * @param {object} [options] - optional overrides (resendClient, config) for testing
 * @returns {Promise<{ ok: boolean, error?: string, id?: string }>}
 */
export async function sendEnquiryEmail(enquiry, options = {}) {
  const config = options.config || getEmailConfig();

  if (!config.isConfigured) {
    const errorMsg = `Server email configuration incomplete: missing ${config.missing.join(", ")}.`;
    console.error(`[emailService] ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  try {
    const resend = options.resendClient || getResendClient(config.apiKey);
    const recipient = resolveRecipientEmail(enquiry.region, config.contactEmail);
    const subjectPrefix = enquiry.type ? enquiry.type.toUpperCase() : "GENERAL";
    const regionSuffix =
      enquiry.region && typeof enquiry.region === "string"
        ? ` - ${enquiry.region.trim().toUpperCase()}`
        : "";

    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: [recipient],
      replyTo: enquiry.email,
      subject: `[Enquiry${regionSuffix}] ${subjectPrefix} from ${enquiry.fullname} — ${enquiry.company}`,
      html: buildEnquiryHtml(enquiry),
    });

    if (error) {
      console.error(
        "[emailService] Resend email delivery failed:",
        error.message || error
      );
      return { ok: false, error: error.message || "Resend email delivery failed." };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    console.error(
      "[emailService] Unexpected error sending enquiry email:",
      err.message || err
    );
    return { ok: false, error: err.message || "Unexpected email error." };
  }
}

/**
 * Send a career application email with optional resume attachment.
 * @param {object} application - validated career application record
 * @param {Buffer|null} resumeBuffer - raw file bytes
 * @param {string|null} resumeFilename - original file name
 * @param {string|null} resumeMimeType - MIME type
 * @param {object} [options] - optional overrides (resendClient, config) for testing
 * @returns {Promise<{ ok: boolean, error?: string, id?: string }>}
 */
export async function sendCareerEmail(
  application,
  resumeBuffer,
  resumeFilename,
  resumeMimeType,
  options = {}
) {
  const config = options.config || getEmailConfig();

  if (!config.isConfigured) {
    const errorMsg = `Server email configuration incomplete: missing ${config.missing.join(", ")}.`;
    console.error(`[emailService] ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  try {
    const resend = options.resendClient || getResendClient(config.apiKey);
    const attachments =
      resumeBuffer && resumeFilename
        ? [
          {
            filename: resumeFilename,
            content: resumeBuffer,
            contentType: resumeMimeType || "application/octet-stream",
          },
        ]
        : [];

    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: [config.contactEmail],
      replyTo: application.email,
      subject: `[Career] ${application.position} — ${application.fullname}`,
      html: buildCareerHtml(application),
      attachments,
    });

    if (error) {
      console.error(
        "[emailService] Resend career application delivery failed:",
        error.message || error
      );
      return {
        ok: false,
        error: error.message || "Resend career application delivery failed.",
      };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    console.error(
      "[emailService] Unexpected error sending career email:",
      err.message || err
    );
    return { ok: false, error: err.message || "Unexpected email error." };
  }
}

/**
 * Send a branded acknowledgement email to the customer.
 * Dispatches to enquiry.email using config.fromEmail.
 * Never sets internal regional sales addresses as to, cc, bcc, or replyTo.
 *
 * @param {object} enquiry - validated enquiry record
 * @param {object} [options] - optional overrides (resendClient, config) for testing
 * @returns {Promise<{ ok: boolean, error?: string, id?: string }>}
 */
export async function sendAcknowledgementEmail(enquiry, options = {}) {
  const config = options.config || getEmailConfig();

  if (!config.isConfigured) {
    const errorMsg = `Server email configuration incomplete: missing ${config.missing.join(", ")}.`;
    console.error(`[emailService] ${errorMsg}`);
    return { ok: false, error: errorMsg };
  }

  if (!enquiry || !enquiry.email) {
    return { ok: false, error: "Missing customer recipient email." };
  }

  try {
    const resend = options.resendClient || getResendClient(config.apiKey);
    const refCode = formatEnquiryReference(enquiry.id);

    const { data, error } = await resend.emails.send({
      from: config.fromEmail,
      to: [enquiry.email.trim()],
      subject: `Enquiry Received [Ref: #${refCode}] — ICON Electromatic`,
      html: buildAcknowledgementHtml(enquiry),
    });

    if (error) {
      console.error(
        "[emailService] Resend customer acknowledgement delivery failed:",
        error.message || error
      );
      return {
        ok: false,
        error: error.message || "Resend customer acknowledgement delivery failed.",
      };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    console.error(
      "[emailService] Unexpected error sending customer acknowledgement email:",
      err.message || err
    );
    return {
      ok: false,
      error: err.message || "Unexpected customer acknowledgement email error.",
    };
  }
}
