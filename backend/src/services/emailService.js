/**
 * emailService.js — Resend-backed email delivery for enquiries and career applications.
 *
 * Graceful degradation: if RESEND_API_KEY is not set (local dev), submissions are
 * logged to the console and the caller is told delivery was skipped. No error is thrown.
 *
 * Why Resend over Nodemailer:
 *   - Single API call, no SMTP configuration
 *   - Free tier: 3,000 emails/month
 *   - Works reliably from Indian-hosted servers without port 25/587 issues
 */

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "";
const ENQUIRY_FROM = process.env.ENQUIRY_FROM || "onboarding@resend.dev";

// Lazily initialised so tests that never call send() don't require the key.
let _resend = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

function isConfigured() {
  return Boolean(RESEND_API_KEY && CONTACT_EMAIL);
}

/**
 * Escape plain-text content for inclusion in an HTML email.
 * Only escapes characters that are meaningful inside HTML text nodes.
 */
function esc(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

/**
 * Build the HTML body for a contact / RFQ enquiry email.
 * @param {object} e - validated enquiry fields
 */
function buildEnquiryHtml(e) {
  const subjectLabels = {
    rfq: "Formal Request for Quotation (RFQ)",
    technical: "Technical Support & Specifications",
    bespoke: "Bespoke RF Component Engineering",
    delivery: "Lead Time & Logistics Verification",
    general: "General Corporate Inquiry",
  };
  const subjectLabel = subjectLabels[e.type] || e.type;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New Enquiry — ICON Electromatic</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
    <div style="background:#1e3a5f;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">New Enquiry — ICON Electromatic</h2>
      <p style="color:#a0b4c8;margin:4px 0 0;font-size:13px;">Received via iconelectromatic.com/contact</p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:36%;vertical-align:top;"><strong>Name</strong></td><td style="padding:8px 0;">${esc(e.fullname)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Company</strong></td><td style="padding:8px 0;">${esc(e.company)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Email</strong></td><td style="padding:8px 0;"><a href="mailto:${esc(e.email)}">${esc(e.email)}</a></td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Phone</strong></td><td style="padding:8px 0;">${esc(e.phone)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;vertical-align:top;"><strong>Subject</strong></td><td style="padding:8px 0;">${esc(subjectLabel)}</td></tr>
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
function buildCareerHtml(a) {
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
      <h2 style="color:#fff;margin:0;font-size:18px;">Career Application — ICON Electromatic</h2>
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
 * Send a contact / RFQ enquiry email.
 * @param {object} enquiry - validated enquiry record (from DB or validation layer)
 * @returns {{ ok: boolean, error?: string }}
 */
export async function sendEnquiryEmail(enquiry) {
  if (!isConfigured()) {
    console.warn(
      "[emailService] RESEND_API_KEY or CONTACT_EMAIL not set. Skipping email delivery for enquiry:",
      enquiry.id
    );
    return { ok: false, error: "Email delivery not configured." };
  }

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: ENQUIRY_FROM,
      to: [CONTACT_EMAIL],
      replyTo: enquiry.email,
      subject: `[Enquiry] ${enquiry.type.toUpperCase()} from ${enquiry.fullname} — ${enquiry.company}`,
      html: buildEnquiryHtml(enquiry),
    });

    if (error) {
      return { ok: false, error: error.message || "Resend returned an error." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Unexpected email error." };
  }
}

/**
 * Send a career application email with optional resume attachment.
 * @param {object} application - validated career application record
 * @param {Buffer|null} resumeBuffer - raw file bytes (may be null if not provided)
 * @param {string|null} resumeFilename - original file name
 * @param {string|null} resumeMimeType - MIME type
 * @returns {{ ok: boolean, error?: string }}
 */
export async function sendCareerEmail(
  application,
  resumeBuffer,
  resumeFilename,
  resumeMimeType
) {
  if (!isConfigured()) {
    console.warn(
      "[emailService] RESEND_API_KEY or CONTACT_EMAIL not set. Skipping email delivery for career application:",
      application.id
    );
    return { ok: false, error: "Email delivery not configured." };
  }

  try {
    const resend = getResend();
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

    const { error } = await resend.emails.send({
      from: ENQUIRY_FROM,
      to: [CONTACT_EMAIL],
      replyTo: application.email,
      subject: `[Career] ${application.position} — ${application.fullname}`,
      html: buildCareerHtml(application),
      attachments,
    });

    if (error) {
      return { ok: false, error: error.message || "Resend returned an error." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Unexpected email error." };
  }
}
