/**
 * emailService.test.js — Dedicated unit tests for emailService.js
 *
 * Requirements verified:
 *   - Primary sender variable: RESEND_FROM_EMAIL
 *   - Backward-compatible fallback: ENQUIRY_FROM
 *   - Destination inbox: CONTACT_EMAIL
 *   - API key: RESEND_API_KEY
 *   - Production forbids silent fallback to onboarding@resend.dev
 *   - Missing configuration produces clear server-side configuration error
 *   - HTML escaping prevents XSS in email bodies
 *   - Resend API errors and network exceptions are handled gracefully
 *   - Zero real emails sent (Resend client is mocked)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  getEmailConfig,
  esc,
  buildEnquiryHtml,
  buildCareerHtml,
  buildAcknowledgementHtml,
  sendEnquiryEmail,
  sendCareerEmail,
  sendAcknowledgementEmail,
  formatEnquiryReference,
  REGIONAL_CONTACT_EMAILS,
  REGIONAL_LABELS,
  resolveRecipientEmail,
} from "../src/services/emailService.js";

// Helper to temporarily isolate process.env
function withEnv(vars, fn) {
  const original = { ...process.env };
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(vars)) {
      if (original[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = original[k];
      }
    }
  }
}

// ─── 1. Configuration tests ───────────────────────────────────────────────────

test("getEmailConfig — valid configuration with RESEND_FROM_EMAIL", () => {
  withEnv(
    {
      RESEND_API_KEY: "re_test_key_123",
      RESEND_FROM_EMAIL: "dispatch@iconelectromatic.com",
      ENQUIRY_FROM: undefined,
      CONTACT_EMAIL: "sales@iconelectromatic.com",
      NODE_ENV: "production",
    },
    () => {
      const config = getEmailConfig();
      assert.equal(config.isConfigured, true);
      assert.equal(config.apiKey, "re_test_key_123");
      assert.equal(config.fromEmail, "dispatch@iconelectromatic.com");
      assert.equal(config.contactEmail, "sales@iconelectromatic.com");
      assert.deepEqual(config.missing, []);
    }
  );
});

test("getEmailConfig — backward-compatible fallback to ENQUIRY_FROM", () => {
  withEnv(
    {
      RESEND_API_KEY: "re_test_key_123",
      RESEND_FROM_EMAIL: undefined,
      ENQUIRY_FROM: "legacy@iconelectromatic.com",
      CONTACT_EMAIL: "sales@iconelectromatic.com",
      NODE_ENV: "production",
    },
    () => {
      const config = getEmailConfig();
      assert.equal(config.isConfigured, true);
      assert.equal(config.fromEmail, "legacy@iconelectromatic.com");
      assert.deepEqual(config.missing, []);
    }
  );
});

test("getEmailConfig — RESEND_FROM_EMAIL takes precedence over ENQUIRY_FROM", () => {
  withEnv(
    {
      RESEND_API_KEY: "re_test_key_123",
      RESEND_FROM_EMAIL: "primary@iconelectromatic.com",
      ENQUIRY_FROM: "legacy@iconelectromatic.com",
      CONTACT_EMAIL: "sales@iconelectromatic.com",
      NODE_ENV: "production",
    },
    () => {
      const config = getEmailConfig();
      assert.equal(config.fromEmail, "primary@iconelectromatic.com");
    }
  );
});

test("getEmailConfig — production forbids fallback to onboarding@resend.dev", () => {
  withEnv(
    {
      RESEND_API_KEY: "re_test_key_123",
      RESEND_FROM_EMAIL: undefined,
      ENQUIRY_FROM: undefined,
      CONTACT_EMAIL: "sales@iconelectromatic.com",
      NODE_ENV: "production",
    },
    () => {
      const config = getEmailConfig();
      assert.equal(config.isConfigured, false);
      assert.ok(config.missing.includes("RESEND_FROM_EMAIL"));
      assert.notEqual(config.fromEmail, "onboarding@resend.dev");
    }
  );
});

test("getEmailConfig — reports all missing variables when environment is empty", () => {
  withEnv(
    {
      RESEND_API_KEY: undefined,
      RESEND_FROM_EMAIL: undefined,
      ENQUIRY_FROM: undefined,
      CONTACT_EMAIL: undefined,
      NODE_ENV: "production",
    },
    () => {
      const config = getEmailConfig();
      assert.equal(config.isConfigured, false);
      assert.ok(config.missing.includes("RESEND_API_KEY"));
      assert.ok(config.missing.includes("RESEND_FROM_EMAIL"));
      assert.ok(config.missing.includes("CONTACT_EMAIL"));
    }
  );
});

// ─── 2. HTML escaping tests ───────────────────────────────────────────────────

test("esc — properly escapes HTML characters and translates newlines", () => {
  const dirty = '<script>alert("XSS & test\'s")</script>\nLine 2';
  const clean = esc(dirty);
  assert.equal(
    clean,
    '&lt;script&gt;alert(&quot;XSS &amp; test&#39;s&quot;)&lt;/script&gt;<br>Line 2'
  );
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(123), "");
});

test("buildEnquiryHtml — includes escaped enquiry details and maps subject labels", () => {
  const enquiry = {
    fullname: "Ananya <Sharma>",
    company: "BEL & ISRO",
    email: "ananya@example.com",
    phone: "+91 99999 88888",
    type: "rfq",
    model: 'Model "X-100"',
    message: "Requirement for 200 units.\nPlease quote ASAP.",
  };

  const html = buildEnquiryHtml(enquiry);
  assert.ok(html.includes("Ananya &lt;Sharma&gt;"));
  assert.ok(html.includes("BEL &amp; ISRO"));
  assert.ok(html.includes("Formal Request for Quotation (RFQ)"));
  assert.ok(html.includes("Model &quot;X-100&quot;"));
  assert.ok(html.includes("Requirement for 200 units.<br>Please quote ASAP."));
});

test("buildCareerHtml — includes candidate rows and statement", () => {
  const app = {
    fullname: "Rahul Verma",
    email: "rahul@example.com",
    phone: "+91 88888 77777",
    position: "RF Design Engineer",
    city: "Hyderabad",
    experience: "4 years",
    organization: "DRDO",
    notice: "1 month",
    skills: "HFSS, ADS",
    linkedin: "https://linkedin.com/in/rahul",
    statement: "Excited to join.\nReady to relocate.",
    resumeName: "Rahul_CV.pdf",
    resumeSizeKb: 250,
  };

  const html = buildCareerHtml(app);
  assert.ok(html.includes("Rahul Verma"));
  assert.ok(html.includes("RF Design Engineer"));
  assert.ok(html.includes("Rahul_CV.pdf (250 KB)"));
  assert.ok(html.includes("Excited to join.<br>Ready to relocate."));
});

// ─── 3. sendEnquiryEmail tests ─────────────────────────────────────────────────

test("sendEnquiryEmail — fails with explicit server error when configuration is missing", async () => {
  const incompleteConfig = {
    apiKey: "",
    fromEmail: "",
    contactEmail: "",
    isConfigured: false,
    missing: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "CONTACT_EMAIL"],
  };

  const result = await sendEnquiryEmail(
    { fullname: "Test" },
    { config: incompleteConfig }
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.error.includes("RESEND_API_KEY"),
    `Expected missing variable name in: ${result.error}`
  );
});

test("sendEnquiryEmail — successful dispatch calls Resend SDK with correct parameters", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_msg_001" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "sales@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    fullname: "Kavita Rao",
    company: "HAL",
    email: "kavita@hal.co.in",
    phone: "+91 91234 56789",
    type: "technical",
    message: "Technical inquiry message.",
  };

  const result = await sendEnquiryEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.equal(result.id, "resend_msg_001");
  assert.equal(sentPayload.from, "notifications@iconelectromatic.com");
  assert.deepEqual(sentPayload.to, ["sales@iconelectromatic.com"]);
  assert.equal(sentPayload.replyTo, "kavita@hal.co.in");
  assert.ok(sentPayload.subject.includes("[Enquiry] TECHNICAL"));
});

test("sendEnquiryEmail — handles Resend API provider error response", async () => {
  const mockResend = {
    emails: {
      send: async () => ({
        data: null,
        error: { message: "Domain not verified: iconelectromatic.com" },
      }),
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "sales@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const result = await sendEnquiryEmail(
    { fullname: "Test", email: "test@example.com" },
    { config: validConfig, resendClient: mockResend }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "Domain not verified: iconelectromatic.com");
});

test("sendEnquiryEmail — catches unexpected Resend network throw safely", async () => {
  const mockResend = {
    emails: {
      send: async () => {
        throw new Error("ETIMEDOUT: Connection to api.resend.com timed out");
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "sales@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const result = await sendEnquiryEmail(
    { fullname: "Test", email: "test@example.com" },
    { config: validConfig, resendClient: mockResend }
  );

  assert.equal(result.ok, false);
  assert.ok(result.error.includes("ETIMEDOUT"));
});

// ─── 4. sendCareerEmail tests ──────────────────────────────────────────────────

test("sendCareerEmail — successful dispatch includes attachment and recipient", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_career_002" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "careers-dispatch@iconelectromatic.com",
    contactEmail: "careers@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const application = {
    fullname: "Suresh Menon",
    email: "suresh@example.com",
    position: "Microwave Engineer",
    statement: "Application text.",
  };

  const resumeBuffer = Buffer.from("DUMMY-PDF-DATA");
  const result = await sendCareerEmail(
    application,
    resumeBuffer,
    "Suresh_Resume.pdf",
    "application/pdf",
    { config: validConfig, resendClient: mockResend }
  );

  assert.equal(result.ok, true);
  assert.equal(result.id, "resend_career_002");
  assert.equal(sentPayload.from, "careers-dispatch@iconelectromatic.com");
  assert.deepEqual(sentPayload.to, ["careers@iconelectromatic.com"]);
  assert.equal(sentPayload.replyTo, "suresh@example.com");
  assert.equal(sentPayload.attachments.length, 1);
  assert.equal(sentPayload.attachments[0].filename, "Suresh_Resume.pdf");
  assert.equal(sentPayload.attachments[0].contentType, "application/pdf");
});

// ─── 5. Regional routing tests ────────────────────────────────────────────────

test("resolveRecipientEmail — returns designated regional addresses", () => {
  const fallback = "default-sales@iconelectromatic.com";
  assert.equal(
    resolveRecipientEmail("INDIA", fallback),
    "salesiepl@iconelectromatic.com"
  );
  assert.equal(
    resolveRecipientEmail("SINGAPORE", fallback),
    "IESing@iconelectromatic.com"
  );
  assert.equal(
    resolveRecipientEmail("USA", fallback),
    "salesiellc@iconelectromatic.com"
  );
});

test("resolveRecipientEmail — handles lowercase, mixed-case, and whitespace inputs", () => {
  const fallback = "default-sales@iconelectromatic.com";
  assert.equal(
    resolveRecipientEmail("india", fallback),
    "salesiepl@iconelectromatic.com"
  );
  assert.equal(
    resolveRecipientEmail("  singapore  ", fallback),
    "IESing@iconelectromatic.com"
  );
  assert.equal(
    resolveRecipientEmail("uSa", fallback),
    "salesiellc@iconelectromatic.com"
  );
});

test("resolveRecipientEmail — falls back to contactEmail for missing, null, empty, or unrecognized region", () => {
  const fallback = "default-sales@iconelectromatic.com";
  assert.equal(resolveRecipientEmail(null, fallback), fallback);
  assert.equal(resolveRecipientEmail(undefined, fallback), fallback);
  assert.equal(resolveRecipientEmail("", fallback), fallback);
  assert.equal(resolveRecipientEmail("   ", fallback), fallback);
  assert.equal(resolveRecipientEmail("EUROPE", fallback), fallback);
  assert.equal(resolveRecipientEmail("attacker@evil.com", fallback), fallback);
});

test("sendEnquiryEmail — dispatches to India sales inbox when region is INDIA", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_india_001" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "fallback@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    fullname: "Ramesh Patel",
    company: "DRDO",
    email: "ramesh@drdo.gov.in",
    phone: "+91 98765 00001",
    type: "rfq",
    region: "INDIA",
    message: "Requirement for radar sub-assemblies in India.",
  };

  const result = await sendEnquiryEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(sentPayload.to, ["salesiepl@iconelectromatic.com"]);
  assert.ok(sentPayload.subject.includes("[Enquiry - INDIA] RFQ"));
  assert.ok(sentPayload.html.includes("India HQ (Bengaluru)"));
});

test("sendEnquiryEmail — dispatches to Singapore sales inbox when region is SINGAPORE", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_sg_001" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "fallback@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    fullname: "Wei Chen",
    company: "A*STAR Singapore",
    email: "wei@astar.edu.sg",
    phone: "+65 6789 0123",
    type: "technical",
    region: "SINGAPORE",
    message: "RF packaging query for Singapore lab.",
  };

  const result = await sendEnquiryEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(sentPayload.to, ["IESing@iconelectromatic.com"]);
  assert.ok(sentPayload.subject.includes("[Enquiry - SINGAPORE] TECHNICAL"));
  assert.ok(sentPayload.html.includes("Singapore Liaison Office"));
});

test("sendEnquiryEmail — dispatches to USA sales inbox when region is USA", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_usa_001" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "fallback@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    fullname: "John Miller",
    company: "Lockheed Martin",
    email: "john.miller@lmco.com",
    phone: "+1 405 555 0199",
    type: "bespoke",
    region: "USA",
    message: "High-frequency waveguide engineering query.",
  };

  const result = await sendEnquiryEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(sentPayload.to, ["salesiellc@iconelectromatic.com"]);
  assert.ok(sentPayload.subject.includes("[Enquiry - USA] BESPOKE"));
  assert.ok(sentPayload.html.includes("USA Liaison Office"));
});

test("sendEnquiryEmail — falls back to CONTACT_EMAIL when region is null or omitted", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_fallback_001" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "central-inbox@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    fullname: "Anand Gupta",
    company: "General Labs",
    email: "anand@generallabs.org",
    phone: "+91 99999 88888",
    type: "general",
    region: null,
    message: "General corporate enquiry without office selection.",
  };

  const result = await sendEnquiryEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(sentPayload.to, ["central-inbox@iconelectromatic.com"]);
  assert.ok(sentPayload.subject.includes("[Enquiry] GENERAL"));
  assert.ok(!sentPayload.html.includes("Target Office"));
});

// ─── 8. Customer Acknowledgement Email Tests ──────────────────────────────────

test("formatEnquiryReference — formats clean uppercase reference code", () => {
  assert.equal(formatEnquiryReference("cm3x8y7z1234abcd"), "IE-1234ABCD");
  assert.equal(formatEnquiryReference("short123"), "IE-SHORT123");
  assert.equal(formatEnquiryReference(null), "IE-ENQUIRY");
  assert.equal(formatEnquiryReference(""), "IE-ENQUIRY");
});

test("buildAcknowledgementHtml — escapes user input and contains client-safe summary", () => {
  const enquiry = {
    id: "cm3x8y7z12345678",
    fullname: "<script>alert('xss')</script> Ravi & Co.",
    company: "Acme & Sons <RF>",
    email: "ravi@example.com",
    phone: "+91 98765 43210",
    type: "rfq",
    region: "INDIA",
    model: 'ZX60-0433+ "High-Power"',
    message: "Line 1\n<script>bad()</script>\nLine 3 & more.",
  };

  const html = buildAcknowledgementHtml(enquiry);

  // Escaping verification
  assert.ok(!html.includes("<script>"), "Must escape opening script tags");
  assert.ok(html.includes("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt; Ravi &amp; Co."));
  assert.ok(html.includes("Acme &amp; Sons &lt;RF&gt;"));
  assert.ok(html.includes("ZX60-0433+ &quot;High-Power&quot;"));
  assert.ok(html.includes("Line 1<br>&lt;script&gt;bad()&lt;/script&gt;<br>Line 3 &amp; more."));

  // Content verification
  assert.ok(html.includes("#IE-12345678"), "Must include reference code");
  assert.ok(html.includes("Formal Request for Quotation (RFQ)"), "Must expand subject label");
  assert.ok(html.includes("India HQ (Bengaluru)"), "Must include public office name");
  assert.ok(html.includes("24 business hours"), "Must include turnaround commitment");
  assert.ok(html.includes("ICON Electromatic"), "Must include brand header");

  // STRICT SECURITY VERIFICATION: Internal sales emails must NEVER be exposed
  for (const salesEmail of Object.values(REGIONAL_CONTACT_EMAILS)) {
    assert.ok(
      !html.includes(salesEmail),
      `Customer acknowledgement HTML must NEVER contain internal sales email: ${salesEmail}`
    );
  }
});

test("buildAcknowledgementHtml — omits target office row when region is null", () => {
  const enquiry = {
    id: "cm3x8y7z87654321",
    fullname: "Sarah Jenkins",
    company: "Defense Dynamics",
    email: "sarah@defensedyn.com",
    phone: "+1 555 123 4567",
    type: "technical",
    region: null,
    model: null,
    message: "Need specifications for millimeter-wave components.",
  };

  const html = buildAcknowledgementHtml(enquiry);
  assert.ok(!html.includes("Target Office"), "Target Office row should be omitted when region is null");
  assert.ok(!html.includes("Target Model / Band"), "Model row should be omitted when model is null");
  assert.ok(html.includes("#IE-87654321"));
  assert.ok(html.includes("Technical Support &amp; Specifications"));
});

test("sendAcknowledgementEmail — dispatches to customer email with configured from and reference subject", async () => {
  let sentPayload = null;
  const mockResend = {
    emails: {
      send: async (payload) => {
        sentPayload = payload;
        return { data: { id: "resend_ack_test_999" }, error: null };
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "salesiepl@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const enquiry = {
    id: "cm3x8y7zabcd1234",
    fullname: "Vikram Malhotra",
    company: "DRDO",
    email: "vikram.m@drdo.res.in",
    phone: "+91 80 1234 5678",
    type: "rfq",
    region: "INDIA",
    model: "RT/duroid 6002",
    message: "Requirement for 200 sheets of high-reliability substrate.",
  };

  const result = await sendAcknowledgementEmail(enquiry, {
    config: validConfig,
    resendClient: mockResend,
  });

  assert.equal(result.ok, true);
  assert.equal(result.id, "resend_ack_test_999");
  assert.equal(sentPayload.from, "notifications@iconelectromatic.com");
  assert.deepEqual(sentPayload.to, ["vikram.m@drdo.res.in"]);
  assert.equal(
    sentPayload.subject,
    "Enquiry Received [Ref: #IE-ABCD1234] — ICON Electromatic"
  );
  assert.ok(sentPayload.html.includes("#IE-ABCD1234"));

  // Confirm no sales addresses exposed in headers or body
  for (const salesEmail of Object.values(REGIONAL_CONTACT_EMAILS)) {
    assert.ok(
      !sentPayload.html.includes(salesEmail),
      `Sent HTML must not leak internal address: ${salesEmail}`
    );
    assert.ok(
      sentPayload.to[0] !== salesEmail,
      `Recipient must be the customer, not internal sales: ${salesEmail}`
    );
  }
});

test("sendAcknowledgementEmail — returns clean diagnostic when server email config is incomplete", async () => {
  const invalidConfig = {
    apiKey: "",
    fromEmail: "",
    contactEmail: "",
    isConfigured: false,
    missing: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "CONTACT_EMAIL"],
  };

  const result = await sendAcknowledgementEmail(
    { id: "test", email: "user@example.com" },
    { config: invalidConfig }
  );

  assert.equal(result.ok, false);
  assert.ok(result.error.includes("Server email configuration incomplete"));
  assert.ok(result.error.includes("missing RESEND_API_KEY"));
});

test("sendAcknowledgementEmail — returns error when customer email is missing", async () => {
  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "salesiepl@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const result = await sendAcknowledgementEmail(
    { id: "test", email: "" },
    { config: validConfig }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "Missing customer recipient email.");
});

test("sendAcknowledgementEmail — handles Resend API delivery error gracefully", async () => {
  const mockResend = {
    emails: {
      send: async () => ({
        data: null,
        error: { message: "Rate limit exceeded on Resend endpoint." },
      }),
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "salesiepl@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const result = await sendAcknowledgementEmail(
    { id: "test", email: "user@example.com", fullname: "User" },
    { config: validConfig, resendClient: mockResend }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "Rate limit exceeded on Resend endpoint.");
});

test("sendAcknowledgementEmail — catches unexpected Resend client exceptions gracefully", async () => {
  const mockResend = {
    emails: {
      send: async () => {
        throw new Error("DNS resolution failed for api.resend.com");
      },
    },
  };

  const validConfig = {
    apiKey: "re_mock_123",
    fromEmail: "notifications@iconelectromatic.com",
    contactEmail: "salesiepl@iconelectromatic.com",
    isConfigured: true,
    missing: [],
  };

  const result = await sendAcknowledgementEmail(
    { id: "test", email: "user@example.com", fullname: "User" },
    { config: validConfig, resendClient: mockResend }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "DNS resolution failed for api.resend.com");
});
