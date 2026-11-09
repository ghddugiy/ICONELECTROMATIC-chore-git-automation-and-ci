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
  const communications = new Map();

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
    enquiryCommunication: {
      create: async (args) => {
        const rec = {
          id: `comm-${++idCounter}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        communications.set(rec.id, rec);
        return rec;
      },
      findFirst: async (args) => {
        for (const c of communications.values()) {
          if (args?.where?.enquiryId && c.enquiryId !== args.where.enquiryId) continue;
          if (args?.where?.type && c.type !== args.where.type) continue;
          return c;
        }
        return null;
      },
      findMany: async (args) => {
        const list = [];
        for (const c of communications.values()) {
          if (args?.where?.enquiryId && c.enquiryId !== args.where.enquiryId) continue;
          if (args?.where?.type && c.type !== args.where.type) continue;
          list.push(c);
        }
        return list;
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
    _communications: communications,
  };
}

const mockEmailOk = async () => ({ ok: true });
const mockEmailFail = async () => ({ ok: false, error: "SMTP connection refused" });

// ─── App factory ─────────────────────────────────────────────────────────────

function makeApp({
  mockPrisma,
  emailEnquiry = mockEmailOk,
  emailCareer = mockEmailOk,
  emailAcknowledgement = mockEmailOk,
  rateLimitMiddleware = null,
  trustProxy = false,
} = {}) {
  const app = express();
  if (trustProxy) app.set("trust proxy", true);
  app.use(express.json());

  const rl = rateLimitMiddleware || ((req, res, next) => next());

  const router = createEnquiriesRouter({
    prismaClient: mockPrisma || makeMockPrisma(),
    emailSendEnquiry: emailEnquiry,
    emailSendCareer: emailCareer,
    emailSendAcknowledgement: emailAcknowledgement,
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

test("POST /api/enquiries/contact — rate limit keys requests by Express-resolved client IP", async () => {
  const tightRl = createEnquiryRateLimit({ windowMs: 60_000, maxAttempts: 1 });
  const { server, baseUrl } = await startServer(
    makeApp({ rateLimitMiddleware: tightRl, trustProxy: true })
  );
  try {
    const submit = (ip) =>
      fetch(`${baseUrl}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify(validContact),
      });

    assert.equal((await submit("198.51.100.10")).status, 201);
    assert.equal((await submit("198.51.100.20")).status, 201);
    assert.equal((await submit("198.51.100.10")).status, 429);
  } finally {
    server.close();
  }
});

test("enquiries — contact and careers store Express-resolved client IPs", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, trustProxy: true })
  );
  try {
    const contactRes = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.42",
      },
      body: JSON.stringify(validContact),
    });
    const careerRes = await fetch(`${baseUrl}/careers`, {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.42" },
      body: buildCareerFormData(validCareerFields, {
        filename: "resume.pdf",
        mimetype: "application/pdf",
        content: "%PDF-1.4 test resume",
      }),
    });

    assert.equal(contactRes.status, 201);
    assert.equal(careerRes.status, 201);
    assert.equal([...mockPrisma._enquiries.values()][0].ip, "203.0.113.42");
    assert.equal([...mockPrisma._careers.values()][0].ip, "203.0.113.42");
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
    assert.ok(
      data.message.includes("could not be dispatched to our team automatically"),
      `Expected corrected message, got: ${data.message}`
    );
    assert.ok(
      !data.message.includes("confirmation email"),
      "Message must not describe internal dispatch as customer confirmation email"
    );
    assert.ok(
      !data.message.includes("SMTP connection refused"),
      "Provider error must not be exposed to the client"
    );

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

// ─── Contact form regional routing tests ─────────────────────────────────────

test("POST /api/enquiries/contact — valid region 'india' stores INDIA and passes to email dispatcher", async () => {
  const mockPrisma = makeMockPrisma();
  let dispatchedRecord = null;
  const mockEmail = async (record) => {
    dispatchedRecord = record;
    return { ok: true, id: "msg-india-123" };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry: mockEmail })
  );
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "india" }),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);

    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.region, "INDIA");
    assert.equal(dispatchedRecord.region, "INDIA");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — handles mixed-case region 'Singapore' and 'uSa'", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(makeApp({ mockPrisma }));
  try {
    const res1 = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "Singapore" }),
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "  uSa  " }),
    });
    assert.equal(res2.status, 201);

    const storedRecords = [...mockPrisma._enquiries.values()];
    assert.equal(storedRecords[0].region, "SINGAPORE");
    assert.equal(storedRecords[1].region, "USA");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — missing, null, empty or whitespace-only region defaults to null", async () => {
  const mockPrisma = makeMockPrisma();
  let dispatched = [];
  const mockEmail = async (record) => {
    dispatched.push(record);
    return { ok: true, id: "msg-null-123" };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry: mockEmail })
  );
  try {
    // 1. Missing / omitted
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });

    // 2. Explicit null
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: null }),
    });

    // 3. Empty string
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "" }),
    });

    // 4. Whitespace only
    await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "   " }),
    });

    const storedRecords = [...mockPrisma._enquiries.values()];
    assert.equal(storedRecords.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(storedRecords[i].region, null);
      assert.equal(dispatched[i].region, null);
    }
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — non-empty unsupported region returns 400 Bad Request", async () => {
  const { server, baseUrl } = await startServer(makeApp());
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "europe" }),
    });
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.ok(
      data.message.includes("region must be one of"),
      `Expected region validation message, got: ${data.message}`
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — ignores client-injected 'to' and 'recipient' fields", async () => {
  const mockPrisma = makeMockPrisma();
  let dispatchedRecord = null;
  const mockEmail = async (record) => {
    dispatchedRecord = record;
    return { ok: true, id: "msg-inject-123" };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry: mockEmail })
  );
  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validContact,
        region: "india",
        to: "attacker@evil.com",
        recipient: "malicious@bad.com",
        dest: "override@hack.org",
      }),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);

    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.to, undefined);
    assert.equal(stored.recipient, undefined);
    assert.equal(dispatchedRecord.to, undefined);
    assert.equal(dispatchedRecord.recipient, undefined);
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

test("POST /api/enquiries/careers — email failure returns 502 and record saved as EMAIL_FAILED", async () => {
  const mockPrisma = makeMockPrisma();
  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailCareer: mockEmailFail })
  );
  try {
    const fd = buildCareerFormData(validCareerFields, {
      filename: "resume.pdf",
      mimetype: "application/pdf",
      content: "PDF-DATA",
    });

    const res = await fetch(`${baseUrl}/careers`, { method: "POST", body: fd });
    const data = await res.json();

    assert.equal(res.status, 502);
    assert.equal(data.success, false);
    assert.ok(
      data.message.includes("could not be dispatched to our team automatically"),
      `Expected corrected message, got: ${data.message}`
    );
    assert.ok(
      !data.message.includes("confirmation"),
      "Message must not describe internal dispatch as customer confirmation"
    );
    assert.ok(
      !data.message.includes("SMTP connection refused"),
      "Provider error must not be exposed to the client"
    );

    assert.equal(mockPrisma._careers.size, 1, "Career record must exist even when email fails");
    const stored = [...mockPrisma._careers.values()][0];
    assert.equal(stored.status, "EMAIL_FAILED");
    assert.ok(
      typeof stored.emailError === "string" && stored.emailError.length > 0
    );
  } finally {
    server.close();
  }
});

// ─── Customer Acknowledgement Email Tests ─────────────────────────────────────

test("POST /api/enquiries/contact — valid submission dispatches both sales notification and customer acknowledgement", async () => {
  const mockPrisma = makeMockPrisma();
  let salesDispatched = null;
  let ackDispatched = null;

  const emailEnquiry = async (rec) => {
    salesDispatched = rec;
    return { ok: true, id: "sales_resend_101" };
  };

  const emailAcknowledgement = async (rec) => {
    ackDispatched = rec;
    return { ok: true, id: "ack_resend_202" };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "singapore" }),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);

    // Both emails must have been dispatched
    assert.ok(salesDispatched !== null, "Internal sales email must be dispatched");
    assert.ok(ackDispatched !== null, "Customer acknowledgement must be dispatched");
    assert.equal(salesDispatched.region, "SINGAPORE");
    assert.equal(ackDispatched.email, validContact.email);

    // Stored enquiry status
    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAILED");
    assert.equal(stored.emailError, null);

    // Stored communication history (both internal sales notification and customer acknowledgement)
    assert.equal(mockPrisma._communications.size, 2);
    const comms = [...mockPrisma._communications.values()];
    const salesComm = comms.find((c) => c.metadata?.channel === "INTERNAL_SALES_NOTIFICATION");
    assert.ok(salesComm, "Internal sales communication must exist");
    assert.equal(salesComm.enquiryId, stored.id);
    assert.equal(salesComm.type, "EMAIL_OUTBOUND");
    assert.equal(salesComm.metadata.deliveryStatus, "SENT");

    const ackComm = comms.find((c) => c.metadata?.channel === "CUSTOMER_ACKNOWLEDGEMENT");
    assert.ok(ackComm, "Customer acknowledgement communication must exist");
    assert.equal(ackComm.enquiryId, stored.id);
    assert.equal(ackComm.type, "EMAIL_OUTBOUND");
    assert.ok(ackComm.subject.includes("Enquiry Received"));
    assert.equal(ackComm.metadata.channel, "CUSTOMER_ACKNOWLEDGEMENT");
    assert.equal(ackComm.metadata.recipient, validContact.email);
    assert.equal(ackComm.metadata.resendMessageId, "ack_resend_202");
    assert.equal(ackComm.metadata.deliveryStatus, "SENT");
    assert.equal(ackComm.metadata.error, null);
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — internal sales failure suppresses customer acknowledgement", async () => {
  const mockPrisma = makeMockPrisma();
  let ackCalled = false;

  const emailEnquiry = async () => ({ ok: false, error: "Sales SMTP failure" });
  const emailAcknowledgement = async () => {
    ackCalled = true;
    return { ok: true };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
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
    assert.equal(ackCalled, false, "Acknowledgement must NOT be sent if sales email failed");

    // Stored enquiry must be marked EMAIL_FAILED
    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAIL_FAILED");
    assert.equal(stored.emailError, "Sales SMTP failure");

    // Failure communication record created for internal sales dispatch
    assert.equal(mockPrisma._communications.size, 1);
    const comm = [...mockPrisma._communications.values()][0];
    assert.equal(comm.type, "EMAIL_OUTBOUND");
    assert.equal(comm.metadata.channel, "INTERNAL_SALES_NOTIFICATION");
    assert.equal(comm.metadata.deliveryStatus, "FAILED");
    assert.equal(comm.metadata.error, "Sales SMTP failure");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — customer acknowledgement failure preserves status EMAILED, does not overwrite emailError, and returns 201", async () => {
  const mockPrisma = makeMockPrisma();

  const emailEnquiry = async () => ({ ok: true, id: "sales_ok_1" });
  const emailAcknowledgement = async () => ({
    ok: false,
    error: "Customer mail server 550 Mailbox unavailable",
  });

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    // Must return 201 because internal sales notification succeeded and enquiry is safely stored
    assert.equal(res.status, 201);
    assert.equal(data.success, true);

    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAILED", "Status must remain EMAILED");
    assert.equal(
      stored.emailError,
      null,
      "emailError must NOT be overwritten with acknowledgement error"
    );

    // Both internal sales success and customer acknowledgement failure documented in EnquiryCommunication
    assert.equal(mockPrisma._communications.size, 2);
    const comms = [...mockPrisma._communications.values()];
    const salesComm = comms.find((c) => c.metadata?.channel === "INTERNAL_SALES_NOTIFICATION");
    assert.ok(salesComm, "Internal sales communication record must exist");
    assert.equal(salesComm.metadata.deliveryStatus, "SENT");

    const ackComm = comms.find((c) => c.metadata?.channel === "CUSTOMER_ACKNOWLEDGEMENT");
    assert.ok(ackComm, "Customer acknowledgement communication record must exist");
    assert.equal(ackComm.type, "EMAIL_OUTBOUND");
    assert.equal(ackComm.metadata.channel, "CUSTOMER_ACKNOWLEDGEMENT");
    assert.equal(ackComm.metadata.deliveryStatus, "FAILED");
    assert.equal(
      ackComm.metadata.error,
      "Customer mail server 550 Mailbox unavailable"
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — duplicate protection skips acknowledgement if outbound communication exists", async () => {
  const mockPrisma = makeMockPrisma();
  let ackCallCount = 0;

  const emailEnquiry = async () => ({ ok: true });
  const emailAcknowledgement = async () => {
    ackCallCount++;
    return { ok: true };
  };

  // Pre-populate mock communication so findMany returns a prior customer acknowledgement communication
  mockPrisma.enquiryCommunication.findMany = async () => [
    {
      id: "existing-ack-1",
      enquiryId: "enq-1",
      type: "EMAIL_OUTBOUND",
      metadata: { channel: "CUSTOMER_ACKNOWLEDGEMENT" },
    },
  ];

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(
      ackCallCount,
      0,
      "Acknowledgement must NOT be dispatched if existing outbound customer acknowledgement was found"
    );
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — internal sales email logging does not suppress customer acknowledgement and records both communication records", async () => {
  const mockPrisma = makeMockPrisma();
  let salesCallCount = 0;
  let ackCallCount = 0;

  const emailEnquiry = async () => {
    salesCallCount++;
    return { ok: true, id: "sales-msg-123" };
  };
  const emailAcknowledgement = async () => {
    ackCallCount++;
    return { ok: true, id: "ack-msg-456" };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, region: "singapore" }),
    });
    const data = await res.json();

    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(salesCallCount, 1, "Sales email must be sent once");
    assert.equal(ackCallCount, 1, "Acknowledgement must NOT be suppressed by sales email logging");

    // Both communications must be recorded
    assert.equal(mockPrisma._communications.size, 2);
    const comms = [...mockPrisma._communications.values()];

    const salesComm = comms.find((c) => c.metadata?.channel === "INTERNAL_SALES_NOTIFICATION");
    assert.ok(salesComm, "Internal sales communication must exist");
    assert.equal(salesComm.metadata.channel, "INTERNAL_SALES_NOTIFICATION");
    assert.equal(salesComm.metadata.recipient, "IESing@iconelectromatic.com");
    assert.equal(salesComm.metadata.deliveryStatus, "SENT");
    assert.equal(salesComm.metadata.resendMessageId, "sales-msg-123");

    const ackComm = comms.find((c) => c.metadata?.channel === "CUSTOMER_ACKNOWLEDGEMENT");
    assert.ok(ackComm, "Customer acknowledgement communication must exist");
    assert.equal(ackComm.metadata.channel, "CUSTOMER_ACKNOWLEDGEMENT");
    assert.equal(ackComm.metadata.recipient, validContact.email);
    assert.equal(ackComm.metadata.deliveryStatus, "SENT");
    assert.equal(ackComm.metadata.resendMessageId, "ack-msg-456");
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — invalid submission or honeypot never sends acknowledgement", async () => {
  const mockPrisma = makeMockPrisma();
  let ackCallCount = 0;
  let salesCallCount = 0;

  const emailEnquiry = async () => {
    salesCallCount++;
    return { ok: true };
  };
  const emailAcknowledgement = async () => {
    ackCallCount++;
    return { ok: true };
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    // 1. Invalid email
    const resInvalid = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, email: "invalid-email" }),
    });
    assert.equal(resInvalid.status, 400);

    // 2. Honeypot bot
    const resHoneypot = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validContact, website: "http://bot.ru" }),
    });
    assert.equal(resHoneypot.status, 200);

    assert.equal(salesCallCount, 0, "No sales email on invalid or honeypot");
    assert.equal(ackCallCount, 0, "No acknowledgement email on invalid or honeypot");
    assert.equal(mockPrisma._enquiries.size, 0);
    assert.equal(mockPrisma._communications.size, 0);
  } finally {
    server.close();
  }
});

test("POST /api/enquiries/contact — internal sales audit insertion failure preserves enquiry status EMAILED and dispatches customer acknowledgement", async () => {
  const mockPrisma = makeMockPrisma();
  let salesCallCount = 0;
  let ackCallCount = 0;

  const emailEnquiry = async () => {
    salesCallCount++;
    return { ok: true, id: "sales-ok-msg" };
  };
  const emailAcknowledgement = async () => {
    ackCallCount++;
    return { ok: true, id: "ack-ok-msg" };
  };

  // Mock enquiryCommunication.create to throw on first call (internal sales audit logging)
  // and succeed on subsequent calls (customer acknowledgement logging)
  let commCreateCalls = 0;
  const originalCreate = mockPrisma.enquiryCommunication.create;
  mockPrisma.enquiryCommunication.create = async (args) => {
    commCreateCalls++;
    if (commCreateCalls === 1) {
      throw new Error("Simulated database failure during audit log insertion");
    }
    return originalCreate(args);
  };

  const { server, baseUrl } = await startServer(
    makeApp({ mockPrisma, emailEnquiry, emailAcknowledgement })
  );

  try {
    const res = await fetch(`${baseUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validContact),
    });
    const data = await res.json();

    // Must still return 201 Created because sales email was sent and enquiry saved
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(salesCallCount, 1, "Sales email must be sent");
    assert.equal(ackCallCount, 1, "Customer acknowledgement must still be sent");

    // The enquiry status must remain accurately EMAILED
    const stored = [...mockPrisma._enquiries.values()][0];
    assert.equal(stored.status, "EMAILED");
    assert.equal(stored.emailError, null);

    // Customer acknowledgement communication was still successfully logged
    assert.equal(mockPrisma._communications.size, 1);
    const comm = [...mockPrisma._communications.values()][0];
    assert.equal(comm.type, "EMAIL_OUTBOUND");
    assert.equal(comm.metadata.channel, "CUSTOMER_ACKNOWLEDGEMENT");
    assert.equal(comm.metadata.deliveryStatus, "SENT");
    assert.equal(comm.metadata.resendMessageId, "ack-ok-msg");
  } finally {
    server.close();
  }
});
