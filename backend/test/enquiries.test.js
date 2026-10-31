/**
 * enquiries.test.js — Tests for POST /api/enquiries/contact and /careers
 *
 * Follows the exact same pattern as auth.test.js:
 *   - app.listen(0) then await the "listening" event before making requests
 *   - Use fetch() with a built baseUrl instead of custom http helpers
 *   - node:test + node:assert/strict
 *   - Injected mock Prisma and email service — no real DB or email calls
 *
 * Multipart requests use the undici FormData / fetch that is built into Node 18+.
 */

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createEnquiriesRouter } from "../src/routes/enquiries.js";
import { createEnquiryRateLimit } from "../src/middleware/enquiryRateLimit.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

let idCounter = 0;

function makeMockPrisma() {
  const enquiries = new Map();
  const careers = new Map();

  return {
    enquiry: {
      create: async (args) => {
        const rec = {
          id: `enq-${++idCounter}`,
          status: "RECEIVED",
          emailError: null,
          ...args.data,
        };
        enquiries.set(rec.id, rec);
        return rec;
      },
      update: async (args) => {
        const rec = enquiries.get(args.where.id);
        if (!rec) throw new Error("Not found");
        Object.assign(rec, args.data);
        return rec;
      },
    },
    careerApplication: {
      create: async (args) => {
        const rec = {
          id: `app-${++idCounter}`,
          status: "RECEIVED",
          emailError: null,
          ...args.data,
        };
        careers.set(rec.id, rec);
        return rec;
      },
      update: async (args) => {
        const rec = careers.get(args.where.id);
        if (!rec) throw new Error("Not found");
        Object.assign(rec, args.data);
        return rec;
      },
    },
    _enquiries: enquiries,
    _careers: careers,
  };
}

const mockEmailOk = async () => ({ ok: true });
const mockEmailFail = async () => ({ ok: false, error: "SMTP connection refused" });

// ─── App factory ─────────────────────────────────────────────────────────────

function makeApp({
  mockPrisma,
  emailEnquiry = mockEmailOk,
  emailCareer = mockEmailOk,
  rateLimitMiddleware = null,
} = {}) {
  const app = express();
  app.use(express.json());

  const rl = rateLimitMiddleware || ((req, res, next) => next());

  const router = createEnquiriesRouter({
    prismaClient: mockPrisma || makeMockPrisma(),
    emailSendEnquiry: emailEnquiry,
    emailSendCareer: emailCareer,
    rateLimitMiddleware: rl,
  });

  app.use("/api/enquiries", router);
  return app;
}

/** Start server and wait until it is listening. Returns { server, baseUrl }. */
async function startServer(app) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/enquiries`;
  return { server, baseUrl };
}

// ─── Valid fixtures ───────────────────────────────────────────────────────────

const validContact = {
  fullname: "Dr. Rajesh Kumar",
  company: "ISRO",
  email: "rajesh@isro.gov.in",
  phone: "+91 98765 43210",
  subject: "rfq",
  model: "RT/duroid 5880",
  message: "We need 500 units for GSLV Mk-III payload bay shielding.",
};

const validCareerFields = {
  fullname: "Vikram Sharma",
  email: "vikram@example.com",
  position: "RF Applications Engineer",
  phone: "+91 80001 23456",
  city: "Bengaluru",
  experience: "3-5 years",
  organization: "BEL",
  notice: "2 months",
  skills: "Keysight ADS, Ansys HFSS, GaN MMIC",
  linkedin: "https://linkedin.com/in/vikramsharma",
  statement:
    "I am a passionate RF engineer with 4 years of experience in GaN power amplifier design.",
};

// ─── Contact form tests ────────────────────────────────────────────────────────

test("POST /api/enquiries/contact — valid submission returns 201 and stores record", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(makeApp({ mockPrisma }));
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(typeof data.id === "string" && data.id.length > 0);

    // Confirm the record was persisted and its email status updated
    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAILED");
    assert.equal(stored.type, "rfq");
    assert.equal(stored.email, "rajesh@isro.gov.in");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — missing required field returns 400", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const { company: _omit, ...body } = validContact;
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("company"),
      `Expected 'company' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — invalid email format returns 400", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, email: "not-an-email" }),
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("email"),
      `Expected 'email' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — message shorter than 10 chars returns 400", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, message: "Short" }),
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("message"),
      `Expected 'message' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — honeypot field filled returns 200 (silent reject)", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(makeApp({ mockPrisma }));
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, website: "http://spam.example.com" }),
    });
    const data = await res.json();

    // Silent 200 — bots must not know they were rejected
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    // No real record must have been stored
    assert.equal(mockPrisma._enquiries.size, 0, "Honeypot submission must not create a record");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — rate limit blocks after threshold", async () => {
  // Tight limiter: allow only 2 per window so the 3rd is rejected
  let fakeNow = Date.now();
  const tightRl = createEnquiryRateLimit({
    windowMs: 60_000,
    maxAttempts: 2,
    now: () => fakeNow,
  });
  const { server, baseUrl } = await startServer(makeApp({ rateLimitMiddleware: tightRl }));
  try {
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    assert.equal(res.status, 429);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("too many"),
      `Expected 'too many' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — email failure returns 502 and record saved as EMAIL_FAILED", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry: mockEmailFail })
  );
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    assert.equal(res.status, 502);
    assert.equal(data.success, false);

    // Record must be saved despite email failure
    assert.equal(mockPrisma._enquiries.size, 1, "Record must exist even when email fails");
    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAIL_FAILED");
    assert.ok(
      typeof stored.emailError === "string" && stored.emailError.length > 0
    );
  } finally {
    server.close();
  }
});

// ─── Careers form tests ────────────────────────────────────────────────────────

/**
 * Build a FormData object for career application tests.
 * Node 18+ has a built-in FormData that fetch() accepts natively.
 */
function buildCareerFormData(fields, file) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  if (file) {
    fd.append(
      "resume",
      new Blob([file.content], { type: file.mimetype }),
      file.filename
    );
  }
  return fd;
}

test("POST /api/enquiries/careers — valid multipart with PDF returns 201", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(makeApp({ mockPrisma }));
  try {
    const fd = buildCareerFormData(validCareerFields, {
      filename: "resume.pdf",
      mimetype: "application/pdf",
      content: "FAKE-PDF-CONTENT",
    });

    const res = await fetch(`${baseUrl}/careers`, { method: "POST", body: fd });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.ok(data.id, "Response must include a record ID");

    const stored = [...mockPrisma._careers.values()][0];
    assert.equal(stored.status, "EMAILED");
    assert.equal(stored.resumeName, "resume.pdf");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/careers — non-PDF resume extension returns 400", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const fd = buildCareerFormData(validCareerFields, {
      filename: "virus.exe",
      mimetype: "application/octet-stream",
      content: "MZ-FAKE",
    });

    const res = await fetch(`${baseUrl}/careers`, { method: "POST", body: fd });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("pdf") ||
        data.message.toLowerCase().includes("resume"),
      `Expected 'pdf' or 'resume' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/careers — missing resume returns 400", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const fd = buildCareerFormData(validCareerFields, null);

    const res = await fetch(`${baseUrl}/careers`, { method: "POST", body: fd });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.toLowerCase().includes("resume"),
      `Expected 'resume' in message: "${data.message}"`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/careers — honeypot field returns 200 (silent reject)", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(makeApp({ mockPrisma }));
  try {
    const fd = buildCareerFormData(
      { ...validCareerFields, website: "http://spambot.example" },
      { filename: "resume.pdf", mimetype: "application/pdf", content: "PDF" }
    );

    const res = await fetch(`${baseUrl}/careers`, { method: "POST", body: fd });
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(
      mockPrisma._careers.size,
      0,
      "Honeypot submission must not create a career record"
    );
  } finally {
    server.close();
  }
});
