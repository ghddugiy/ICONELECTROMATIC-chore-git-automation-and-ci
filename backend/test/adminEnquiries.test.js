/**
 * adminEnquiries.test.js
 *
 * Dedicated test suite for Authenticated Admin Enquiry Workflow & Communication Management:
 *   - Authentication & Authorization enforcement (requireAdmin middleware)
 *   - CSRF protection on mutating endpoints (PATCH, POST)
 *   - Statistics endpoint (GET /api/admin/enquiries/stats)
 *   - Staff listing endpoint (GET /api/admin/enquiries/staff)
 *   - Filtered and paginated listing (GET /api/admin/enquiries)
 *   - Single enquiry detail and chronological history (GET /api/admin/enquiries/:id)
 *   - Workflow status updates and audit logging (PATCH /api/admin/enquiries/:id/status)
 *   - Staff assignment, reassignment, and automatic NEW-to-ASSIGNED transition (PATCH /api/admin/enquiries/:id/assign)
 *   - Manual communication logging (POST /api/admin/enquiries/:id/communications)
 *   - Filtered CSV export with RFC-4180 escaping and formula-injection defense (GET /api/admin/enquiries/export)
 *   - Error handling (404 not found, 400 validation, no permanent deletion)
 */

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import {
  createAdminEnquiriesRouter,
  sanitizeCsvValue,
  ALLOWED_WORKFLOW_STATUSES,
} from "../src/routes/adminEnquiries.js";
import { createRequireAdmin } from "../src/middleware/requireAdmin.js";
import {
  createOpaqueToken,
  hashOpaqueToken,
  getAuthCookieNames,
} from "../src/auth/security.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Mock Prisma Client
// ─────────────────────────────────────────────────────────────────────────────

function createMockPrisma(initialEnquiries = [], initialStaff = [], initialCommunications = []) {
  const enquiries = new Map();
  const communications = new Map();
  const staff = new Map();
  let idCounter = 100;

  for (const s of initialStaff) {
    staff.set(s.id, { ...s });
  }

  for (const c of initialCommunications) {
    communications.set(c.id, {
      ...c,
      createdAt: c.createdAt || new Date(),
      updatedAt: c.updatedAt || new Date(),
    });
  }

  for (const e of initialEnquiries) {
    enquiries.set(e.id, {
      ...e,
      workflowStatus: e.workflowStatus || "NEW",
      status: e.status || "RECEIVED",
      createdAt: e.createdAt || new Date(),
      updatedAt: e.updatedAt || new Date(),
    });
  }

  const mock = {
    _enquiries: enquiries,
    _communications: communications,
    _staff: staff,

    enquiry: {
      async count({ where } = {}) {
        return (await mock.enquiry.findMany({ where })).length;
      },

      async groupBy({ by, _count } = {}) {
        const field = by[0];
        const counts = new Map();
        for (const e of enquiries.values()) {
          const val = e[field] || null;
          counts.set(val, (counts.get(val) || 0) + 1);
        }
        return Array.from(counts.entries()).map(([k, count]) => ({
          [field]: k,
          _count: { _all: count },
        }));
      },

      async findMany({ where = {}, skip = 0, take = 100, orderBy } = {}) {
        let list = Array.from(enquiries.values());

        if (where.region !== undefined) {
          list = list.filter((e) => e.region === where.region);
        }
        if (where.workflowStatus) {
          list = list.filter((e) => e.workflowStatus === where.workflowStatus);
        }
        if (where.assignedToId !== undefined) {
          list = list.filter((e) => e.assignedToId === where.assignedToId);
        }
        if (where.OR && Array.isArray(where.OR)) {
          list = list.filter((e) => {
            return where.OR.some((cond) => {
              const [field, rule] = Object.entries(cond)[0];
              const term = (rule?.contains || "").toLowerCase();
              const val = (e[field] || "").toLowerCase();
              return val.includes(term);
            });
          });
        }
        if (where.createdAt) {
          if (where.createdAt.gte) list = list.filter((e) => new Date(e.createdAt) >= where.createdAt.gte);
          if (where.createdAt.lte) list = list.filter((e) => new Date(e.createdAt) <= where.createdAt.lte);
        }

        // Sort
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const sliced = list.slice(skip, skip + take);

        // Populate relations
        return sliced.map((e) => {
          const eComms = Array.from(communications.values()).filter((c) => c.enquiryId === e.id);
          eComms.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          return {
            ...e,
            assignedTo: e.assignedToId ? staff.get(e.assignedToId) || null : null,
            communications: eComms.map((c) => ({
              ...c,
              author: c.authorId ? staff.get(c.authorId) || null : null,
            })),
            _count: {
              communications: eComms.length,
            },
          };
        });
      },

      async findUnique({ where, include } = {}) {
        const e = enquiries.get(where.id);
        if (!e) return null;

        const res = { ...e };
        if (include?.assignedTo) {
          res.assignedTo = e.assignedToId ? staff.get(e.assignedToId) || null : null;
        }
        if (include?.communications) {
          let commsList = Array.from(communications.values()).filter((c) => c.enquiryId === e.id);
          commsList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          res.communications = commsList.map((c) => ({
            ...c,
            author: c.authorId ? staff.get(c.authorId) || null : null,
          }));
        }
        return res;
      },

      async update({ where, data, include }) {
        const existing = enquiries.get(where.id);
        if (!existing) throw new Error("Not found");
        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        enquiries.set(where.id, updated);

        const res = { ...updated };
        if (include?.assignedTo) {
          res.assignedTo = updated.assignedToId ? staff.get(updated.assignedToId) || null : null;
        }
        return res;
      },
    },

    enquiryCommunication: {
      async create({ data, include }) {
        const id = `comm-${++idCounter}`;
        const record = {
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        communications.set(id, record);

        const res = { ...record };
        if (include?.author) {
          res.author = record.authorId ? staff.get(record.authorId) || null : null;
        }
        return res;
      },

      async findFirst({ where }) {
        for (const c of communications.values()) {
          if (where.enquiryId && c.enquiryId !== where.enquiryId) continue;
          if (where.type && c.type !== where.type) continue;
          return c;
        }
        return null;
      },

      async findMany({ where }) {
        return Array.from(communications.values()).filter((c) => {
          if (where.enquiryId && c.enquiryId !== where.enquiryId) return false;
          if (where.type && c.type !== where.type) return false;
          return true;
        });
      },
    },

    adminUser: {
      async findMany({ where, select } = {}) {
        let list = Array.from(staff.values());
        if (where?.active !== undefined) {
          list = list.filter((s) => s.active === where.active);
        }
        return list.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
        }));
      },

      async findUnique({ where, select } = {}) {
        const s = staff.get(where.id);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
          active: s.active,
        };
      },
    },

    async $transaction(fn) {
      return fn(mock);
    },
  };

  return mock;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Server Helper
// ─────────────────────────────────────────────────────────────────────────────

const mockAdminUser = {
  id: "admin-user-1",
  name: "Admin Officer",
  email: "admin@iconelectromatic.com",
  role: "ADMIN",
  active: true,
};

const mockStaffList = [
  mockAdminUser,
  {
    id: "admin-user-2",
    name: "Vikram Sharma",
    email: "vikram@iconelectromatic.com",
    role: "ADMIN",
    active: true,
  },
  {
    id: "admin-user-inactive",
    name: "Former Staff",
    email: "former@iconelectromatic.com",
    role: "ADMIN",
    active: false,
  },
];

function makePassAdminMiddleware(adminUser = mockAdminUser) {
  return (req, _res, next) => {
    req.adminUser = adminUser;
    req.adminSession = { id: "test-session-1" };
    next();
  };
}

function makeRejectAdminMiddleware(statusCode = 401, message = "Authentication required.") {
  return (_req, res) => {
    res.status(statusCode).json({ success: false, message });
  };
}

async function startServer(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}/api/admin/enquiries`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("sanitizeCsvValue — RFC-4180 escaping and formula injection defense", () => {
  // Safe values
  assert.equal(sanitizeCsvValue("Hello World"), "Hello World");
  assert.equal(sanitizeCsvValue(123), "123");
  assert.equal(sanitizeCsvValue(null), "");
  assert.equal(sanitizeCsvValue(undefined), "");

  // RFC-4180 character escaping
  assert.equal(sanitizeCsvValue('Hello, "World"'), '"Hello, ""World"""');
  assert.equal(sanitizeCsvValue("Line 1\nLine 2"), '"Line 1\nLine 2"');

  // FORMULA INJECTION DEFENSE: Leading =, +, -, @, \t, \r must be prepended with '
  // even when preceded by arbitrary whitespace, tabs, carriage returns, or control codes
  assert.equal(sanitizeCsvValue("=SUM(A1:B1)"), "'=SUM(A1:B1)");
  assert.equal(sanitizeCsvValue("+1234567890"), "'+1234567890");
  assert.equal(sanitizeCsvValue("-cmd|' /C calc'!A0"), "'-cmd|' /C calc'!A0");
  assert.equal(sanitizeCsvValue("@dangerous"), "'@dangerous");
  assert.equal(sanitizeCsvValue("  =1+1"), "'  =1+1");
  assert.equal(sanitizeCsvValue("\t=SUM(A1)"), "'\t=SUM(A1)");
  assert.equal(sanitizeCsvValue("\r+999"), '"\'\r+999"');
  assert.equal(sanitizeCsvValue("\x00@danger"), "'\x00@danger");

  // Legitimate business text starting with | or % is NOT treated as formula and NOT prepended with '
  assert.equal(sanitizeCsvValue("| Model A"), "| Model A");
  assert.equal(sanitizeCsvValue("% Tolerance"), "% Tolerance");
});

test("GET /api/admin/enquiries — rejects unauthenticated request with 401", async () => {
  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(),
    requireAdminMiddleware: makeRejectAdminMiddleware(401, "Authentication required."),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/`);
    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.success, false);
    assert.equal(data.message, "Authentication required.");
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries/stats — returns summary counts by status and region", async () => {
  const initialEnquiries = [
    { id: "e1", fullname: "A", region: "INDIA", workflowStatus: "NEW" },
    { id: "e2", fullname: "B", region: "INDIA", workflowStatus: "ASSIGNED" },
    { id: "e3", fullname: "C", region: "SINGAPORE", workflowStatus: "QUOTED" },
    { id: "e4", fullname: "D", region: "USA", workflowStatus: "CLOSED" },
    { id: "e5", fullname: "E", region: null, workflowStatus: "NEW" }, // historical unclassified
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/stats`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.total, 5);
    assert.equal(data.data.byStatus.NEW, 2);
    assert.equal(data.data.byStatus.ASSIGNED, 1);
    assert.equal(data.data.byStatus.QUOTED, 1);
    assert.equal(data.data.byStatus.CLOSED, 1);
    assert.equal(data.data.byRegion.INDIA, 2);
    assert.equal(data.data.byRegion.SINGAPORE, 1);
    assert.equal(data.data.byRegion.USA, 1);
    assert.equal(data.data.byRegion.UNCLASSIFIED, 1);
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries/staff — returns active staff members only", async () => {
  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma([], mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/staff`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.staff.length, 2);
    assert.ok(data.data.staff.every((s) => s.email !== "former@iconelectromatic.com"));
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries — lists enquiries with search and filters", async () => {
  const initialEnquiries = [
    {
      id: "e1",
      fullname: "Dr. Rajesh Kumar",
      company: "ISRO",
      email: "rajesh@isro.gov.in",
      model: "RT/duroid 5880",
      region: "INDIA",
      workflowStatus: "NEW",
    },
    {
      id: "e2",
      fullname: "Tan Ah Kow",
      company: "ST Engineering",
      email: "tan@stengg.sg",
      model: "ZX60-0433+",
      region: "SINGAPORE",
      workflowStatus: "QUOTED",
    },
    {
      id: "e3",
      fullname: "John Miller",
      company: "Lockheed Martin",
      email: "john@lmco.com",
      model: "Waveguide WR-90",
      region: "USA",
      workflowStatus: "ASSIGNED",
      assignedToId: "admin-user-2",
    },
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. All records
    const resAll = await fetch(`${testServer.baseUrl}/`);
    const dataAll = await resAll.json();
    assert.equal(dataAll.data.items.length, 3);
    assert.equal(dataAll.data.pagination.total, 3);

    // 2. Region filter: INDIA
    const resIndia = await fetch(`${testServer.baseUrl}/?region=INDIA`);
    const dataIndia = await resIndia.json();
    assert.equal(dataIndia.data.items.length, 1);
    assert.equal(dataIndia.data.items[0].fullname, "Dr. Rajesh Kumar");

    // 3. Status filter: QUOTED
    const resQuoted = await fetch(`${testServer.baseUrl}/?workflowStatus=QUOTED`);
    const dataQuoted = await resQuoted.json();
    assert.equal(dataQuoted.data.items.length, 1);
    assert.equal(dataQuoted.data.items[0].company, "ST Engineering");

    // 4. Search filter: "lockheed"
    const resSearch = await fetch(`${testServer.baseUrl}/?search=lockheed`);
    const dataSearch = await resSearch.json();
    assert.equal(dataSearch.data.items.length, 1);
    assert.equal(dataSearch.data.items[0].email, "john@lmco.com");

    // 5. Assignee filter: "admin-user-2"
    const resStaff = await fetch(`${testServer.baseUrl}/?assignedToId=admin-user-2`);
    const dataStaff = await resStaff.json();
    assert.equal(dataStaff.data.items.length, 1);
    assert.equal(dataStaff.data.items[0].assignedTo.email, "vikram@iconelectromatic.com");
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries/:id — returns detail with chronological communication history", async () => {
  const mockPrisma = createMockPrisma(
    [
      {
        id: "cm3x-enq-101",
        fullname: "Dr. Rajesh Kumar",
        company: "ISRO",
        email: "rajesh@isro.gov.in",
        phone: "+91 98765 43210",
        type: "rfq",
        message: "Requirement for 500 units.",
        region: "INDIA",
        workflowStatus: "NEW",
        assignedToId: "admin-user-1",
      },
    ],
    mockStaffList
  );

  // Pre-seed communications
  await mockPrisma.enquiryCommunication.create({
    data: {
      enquiryId: "cm3x-enq-101",
      type: "EMAIL_OUTBOUND",
      subject: "Enquiry Received [Ref: #IE-XENQ101] — ICON Electromatic",
      body: "Automated customer acknowledgement email dispatched.",
      createdAt: new Date("2026-11-06T00:00:01.000Z"),
    },
  });

  await mockPrisma.enquiryCommunication.create({
    data: {
      enquiryId: "cm3x-enq-101",
      type: "INTERNAL_NOTE",
      subject: "Priority assessment",
      body: "High priority space defense project.",
      authorId: "admin-user-1",
      createdAt: new Date("2026-11-06T00:05:00.000Z"),
    },
  });

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/cm3x-enq-101`);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.enquiry.fullname, "Dr. Rajesh Kumar");
    assert.equal(data.data.enquiry.assignedTo.email, "admin@iconelectromatic.com");
    assert.equal(data.data.enquiry.communications.length, 2);
    assert.equal(data.data.enquiry.communications[0].type, "EMAIL_OUTBOUND");
    assert.equal(data.data.enquiry.communications[1].type, "INTERNAL_NOTE");
    assert.equal(data.data.enquiry.communications[1].author.email, "admin@iconelectromatic.com");

    // 404 for non-existent ID
    const resNotFound = await fetch(`${testServer.baseUrl}/non-existent-id`);
    assert.equal(resNotFound.status, 404);
  } finally {
    await testServer.close();
  }
});

test("PATCH /api/admin/enquiries/:id/status — updates status in transaction and creates STATUS_CHANGE communication", async () => {
  const mockPrisma = createMockPrisma(
    [
      {
        id: "enq-status-test",
        fullname: "Alice",
        workflowStatus: "NEW",
      },
    ],
    mockStaffList
  );

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. Invalid status returns 400
    const resInvalid = await fetch(`${testServer.baseUrl}/enq-status-test/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowStatus: "INVALID_STATUS" }),
    });
    assert.equal(resInvalid.status, 400);

    // 2. Valid status transition to IN_PROGRESS
    const resValid = await fetch(`${testServer.baseUrl}/enq-status-test/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowStatus: "IN_PROGRESS",
        note: "Reviewed specifications with engineering team.",
      }),
    });
    const dataValid = await resValid.json();

    assert.equal(resValid.status, 200);
    assert.equal(dataValid.data.enquiry.workflowStatus, "IN_PROGRESS");

    // Verify communication audit trail
    const comms = Array.from(mockPrisma._communications.values());
    assert.equal(comms.length, 1);
    assert.equal(comms[0].type, "STATUS_CHANGE");
    assert.ok(comms[0].body.includes("Reviewed specifications"));
    assert.equal(comms[0].metadata.previousStatus, "NEW");
    assert.equal(comms[0].metadata.newStatus, "IN_PROGRESS");
    assert.equal(comms[0].authorId, "admin-user-1");
  } finally {
    await testServer.close();
  }
});

test("PATCH /api/admin/enquiries/:id/assign — assigns staff, auto-advances NEW to ASSIGNED, and logs history", async () => {
  const mockPrisma = createMockPrisma(
    [
      {
        id: "enq-assign-test",
        fullname: "Bob",
        workflowStatus: "NEW",
        assignedToId: null,
      },
    ],
    mockStaffList
  );

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. Assign to inactive user returns 400
    const resInactive = await fetch(`${testServer.baseUrl}/enq-assign-test/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: "admin-user-inactive" }),
    });
    assert.equal(resInactive.status, 400);

    // 2. Assign to valid user: admin-user-2
    const resAssign = await fetch(`${testServer.baseUrl}/enq-assign-test/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedToId: "admin-user-2",
        note: "Assigning to regional RF specialist.",
      }),
    });
    const dataAssign = await resAssign.json();

    assert.equal(resAssign.status, 200);
    assert.equal(dataAssign.data.enquiry.assignedToId, "admin-user-2");
    // Verify automatic NEW -> ASSIGNED status advancement
    assert.equal(dataAssign.data.enquiry.workflowStatus, "ASSIGNED");

    // Verify communication audit trail
    const comms = Array.from(mockPrisma._communications.values());
    assert.equal(comms.length, 1);
    assert.equal(comms[0].type, "STATUS_CHANGE");
    assert.equal(comms[0].metadata.previousAssigneeEmail, "Unassigned");
    assert.equal(comms[0].metadata.newAssigneeEmail, "vikram@iconelectromatic.com");
    assert.equal(comms[0].metadata.autoTransitioned, true);

    // 3. Clear assignment (unassign)
    const resUnassign = await fetch(`${testServer.baseUrl}/enq-assign-test/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: null }),
    });
    const dataUnassign = await resUnassign.json();
    assert.equal(dataUnassign.data.enquiry.assignedToId, null);
    // WorkflowStatus remains ASSIGNED (does not regress)
    assert.equal(dataUnassign.data.enquiry.workflowStatus, "ASSIGNED");
  } finally {
    await testServer.close();
  }
});

test("POST /api/admin/enquiries/:id/communications — logs manual notes, customer replies, and phone calls", async () => {
  const mockPrisma = createMockPrisma(
    [
      {
        id: "enq-comm-test",
        fullname: "Charlie",
        workflowStatus: "ASSIGNED",
      },
    ],
    mockStaffList
  );

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. Invalid communication type returns 400
    const resInvalidType = await fetch(`${testServer.baseUrl}/enq-comm-test/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "INVALID_COMM_TYPE", body: "Hello" }),
    });
    assert.equal(resInvalidType.status, 400);

    // 2. Empty body returns 400
    const resEmptyBody = await fetch(`${testServer.baseUrl}/enq-comm-test/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "INTERNAL_NOTE", body: "   " }),
    });
    assert.equal(resEmptyBody.status, 400);

    // 3. Log CUSTOMER_REPLY
    const resReply = await fetch(`${testServer.baseUrl}/enq-comm-test/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CUSTOMER_REPLY",
        subject: "Customer verbal spec update",
        body: "Customer agreed on 8-week delivery schedule.",
      }),
    });
    const dataReply = await resReply.json();
    assert.equal(resReply.status, 201);
    assert.equal(dataReply.data.communication.type, "CUSTOMER_REPLY");
    assert.equal(dataReply.data.communication.author.email, "admin@iconelectromatic.com");

    // 4. Log PHONE_LOG
    const resPhone = await fetch(`${testServer.baseUrl}/enq-comm-test/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PHONE_LOG",
        subject: "Call with procurement director",
        body: "Call duration 12 mins. Sent revised MOQ requirements.",
        metadata: { callDuration: 12 },
      }),
    });
    assert.equal(resPhone.status, 201);

    // 5. Log INTERNAL_NOTE
    const resNote = await fetch(`${testServer.baseUrl}/enq-comm-test/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "INTERNAL_NOTE",
        body: "Need technical sign-off on dielectric substrate tolerance.",
      }),
    });
    assert.equal(resNote.status, 201);

    assert.equal(mockPrisma._communications.size, 3);
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries/export — outputs valid RFC-4180 CSV with formula injection protection and UTF-8 BOM", async () => {
  const initialEnquiries = [
    {
      id: "cm3x-csv-001",
      createdAt: new Date("2026-11-06T01:30:00.000Z"),
      fullname: "=CMD|' /C calc'!A0", // Malicious formula injection attempt
      company: "Acme, Inc.",
      email: "safe@acme.com",
      phone: "+91 99999 88888",
      type: "rfq",
      model: "ZX60-0433+",
      region: "INDIA",
      workflowStatus: "NEW",
      status: "EMAILED",
      message: 'Hello, "World"\nNew line requirement.',
    },
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/export`);
    const arrayBuffer = await res.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const csv = rawBuffer.toString("utf-8");

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("text/csv"));
    assert.ok(res.headers.get("content-disposition").includes("attachment; filename="));

    // Confirm UTF-8 BOM bytes (0xEF, 0xBB, 0xBF)
    assert.equal(rawBuffer[0], 0xef, "Byte 0 must be UTF-8 BOM 0xEF");
    assert.equal(rawBuffer[1], 0xbb, "Byte 1 must be UTF-8 BOM 0xBB");
    assert.equal(rawBuffer[2], 0xbf, "Byte 2 must be UTF-8 BOM 0xBF");

    // Confirm formula injection protection: prepended single quote (')
    assert.ok(
      csv.includes("'=CMD|' /C calc'!A0"),
      "Must sanitize leading '=' formula injection character"
    );

    // Confirm RFC-4180 escaping for commas, quotes, and newlines
    assert.ok(csv.includes('"Acme, Inc."'));
    assert.ok(csv.includes('""World""'));

    // Confirm aggregate columns exist
    assert.ok(csv.includes("Total Communications Count"));
    assert.ok(csv.includes("Latest Activity Date (UTC)"));
  } finally {
    await testServer.close();
  }
});

test("GET /api/admin/enquiries/export-communications and /export?type=communications — outputs valid RFC-4180 CSV with communication details and UTF-8 BOM", async () => {
  const initialEnquiries = [
    {
      id: "cm3x-comm-enq",
      createdAt: new Date("2026-11-06T01:00:00.000Z"),
      fullname: "Priya Patel",
      company: "ISRO SAC",
      email: "priya@sac.isro.gov.in",
      phone: "+91 98888 77777",
      region: "INDIA",
      workflowStatus: "IN_PROGRESS",
    },
  ];

  const initialCommunications = [
    {
      id: "comm-001",
      enquiryId: "cm3x-comm-enq",
      createdAt: new Date("2026-11-06T01:05:00.000Z"),
      type: "EMAIL_OUTBOUND",
      subject: "Internal Sales Notification Dispatched",
      body: "Dispatched to salesiepl@iconelectromatic.com",
      metadata: { channel: "INTERNAL_SALES_NOTIFICATION", recipient: "salesiepl@iconelectromatic.com", deliveryStatus: "SENT" },
      authorId: null,
    },
    {
      id: "comm-002",
      enquiryId: "cm3x-comm-enq",
      createdAt: new Date("2026-11-06T01:10:00.000Z"),
      type: "INTERNAL_NOTE",
      subject: "Lab specs confirmed",
      body: "Verified mmWave requirement with design team.",
      metadata: null,
      authorId: "admin-user-1",
    },
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList, initialCommunications),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. Test dedicated /export-communications
    const res = await fetch(`${testServer.baseUrl}/export-communications`);
    const arrayBuffer = await res.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const csv = rawBuffer.toString("utf-8");

    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("text/csv"));
    assert.ok(res.headers.get("content-disposition").includes("attachment; filename="));

    // Confirm UTF-8 BOM
    assert.equal(rawBuffer[0], 0xef);
    assert.equal(rawBuffer[1], 0xbb);
    assert.equal(rawBuffer[2], 0xbf);

    // Confirm header columns
    assert.ok(csv.includes("Enquiry Reference"));
    assert.ok(csv.includes("Communication Type"));
    assert.ok(csv.includes("Author / System"));
    assert.ok(csv.includes("Delivery Status"));
    assert.ok(csv.includes("Channel / Recipient"));

    // Confirm data rows
    assert.ok(csv.includes("Priya Patel"));
    assert.ok(csv.includes("INTERNAL_SALES_NOTIFICATION"));
    assert.ok(csv.includes("salesiepl@iconelectromatic.com"));
    assert.ok(csv.includes("Automated System"));
    assert.ok(csv.includes("Verified mmWave requirement"));
    assert.ok(csv.includes("admin@iconelectromatic.com"));

    // 2. Test /export?type=communications returns same structure
    const resParam = await fetch(`${testServer.baseUrl}/export?type=communications`);
    assert.equal(resParam.status, 200);
    const csvParam = await resParam.text();
    assert.ok(csvParam.includes("Communication ID"));
    assert.ok(csvParam.includes("Verified mmWave requirement"));
  } finally {
    await testServer.close();
  }
});

test("Optimistic concurrency — PATCH /:id/status and PATCH /:id/assign reject stale expectedUpdatedAt with 409 CONCURRENT_MODIFICATION", async () => {
  const originalDate = new Date("2026-11-06T02:00:00.000Z");
  const staleDate = new Date("2026-11-05T00:00:00.000Z");

  const initialEnquiries = [
    {
      id: "cm3x-concurrency-enq",
      createdAt: originalDate,
      updatedAt: originalDate,
      fullname: "Ananya Roy",
      company: "DRDO",
      email: "ananya@drdo.gov.in",
      region: "INDIA",
      workflowStatus: "NEW",
    },
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    // 1. PATCH status with stale expectedUpdatedAt -> 409 Conflict
    const resStatusConflict = await fetch(`${testServer.baseUrl}/cm3x-concurrency-enq/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowStatus: "IN_PROGRESS",
        expectedUpdatedAt: staleDate.toISOString(),
      }),
    });
    const statusConflictData = await resStatusConflict.json();
    assert.equal(resStatusConflict.status, 409);
    assert.equal(statusConflictData.success, false);
    assert.equal(statusConflictData.code, "CONCURRENT_MODIFICATION");
    assert.ok(statusConflictData.message.includes("modified by another user"));

    // 2. PATCH status with matching expectedUpdatedAt -> 200 OK
    const resStatusOk = await fetch(`${testServer.baseUrl}/cm3x-concurrency-enq/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowStatus: "IN_PROGRESS",
        expectedUpdatedAt: originalDate.toISOString(),
      }),
    });
    const statusOkData = await resStatusOk.json();
    assert.equal(resStatusOk.status, 200);
    assert.equal(statusOkData.success, true);
    assert.equal(statusOkData.data.enquiry.workflowStatus, "IN_PROGRESS");

    // 3. PATCH assign with stale expectedUpdatedAt -> 409 Conflict
    const resAssignConflict = await fetch(`${testServer.baseUrl}/cm3x-concurrency-enq/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedToId: "admin-user-2",
        expectedUpdatedAt: staleDate.toISOString(),
      }),
    });
    const assignConflictData = await resAssignConflict.json();
    assert.equal(resAssignConflict.status, 409);
    assert.equal(assignConflictData.code, "CONCURRENT_MODIFICATION");
  } finally {
    await testServer.close();
  }
});

test("Optimistic concurrency — sequential status and assignment update in one save succeeds by chaining the refreshed updatedAt", async () => {
  const initialTime = new Date("2026-11-06T03:00:00.000Z");
  const initialEnquiries = [
    {
      id: "dual-concurrency-enq",
      createdAt: initialTime,
      updatedAt: initialTime,
      fullname: "Kavita Rao",
      company: "HAL",
      email: "kavita@hal.co.in",
      region: "INDIA",
      workflowStatus: "NEW",
      assignedToId: null,
    },
  ];

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(initialEnquiries, mockStaffList),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    let currentExpectedUpdatedAt = initialTime.toISOString();

    // 1. Status update with initial expectedUpdatedAt
    const resStatus = await fetch(`${testServer.baseUrl}/dual-concurrency-enq/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflowStatus: "IN_PROGRESS",
        expectedUpdatedAt: currentExpectedUpdatedAt,
      }),
    });
    const statusData = await resStatus.json();
    assert.equal(resStatus.status, 200);
    assert.equal(statusData.success, true);

    // Refresh expectedUpdatedAt from the returned enquiry
    const refreshedUpdatedAt = statusData.data.enquiry.updatedAt;
    assert.ok(refreshedUpdatedAt, "Must return updated timestamp");
    currentExpectedUpdatedAt = new Date(refreshedUpdatedAt).toISOString();

    // 2. Assignment update immediately following, using the refreshed expectedUpdatedAt
    const resAssign = await fetch(`${testServer.baseUrl}/dual-concurrency-enq/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedToId: "admin-user-2",
        expectedUpdatedAt: currentExpectedUpdatedAt,
      }),
    });
    const assignData = await resAssign.json();
    assert.equal(resAssign.status, 200);
    assert.equal(assignData.success, true);
    assert.equal(assignData.data.enquiry.workflowStatus, "IN_PROGRESS");
    assert.equal(assignData.data.enquiry.assignedToId, "admin-user-2");
  } finally {
    await testServer.close();
  }
});

function setupRealSecurityRouter(activeRole = "ADMIN") {
  const sessionToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const sessionTokenHash = hashOpaqueToken(sessionToken);
  const csrfTokenHash = hashOpaqueToken(csrfToken);

  const activeUser = {
    id: "sec-user-1",
    email: `${activeRole.toLowerCase()}@iconelectromatic.com`,
    role: activeRole,
    active: true,
  };

  const mockPrisma = createMockPrisma([
    { id: "sec-enq-1", fullname: "Sec Test", workflowStatus: "NEW" },
  ]);

  mockPrisma.adminSession = {
    async findUnique({ where }) {
      if (where.tokenHash === sessionTokenHash) {
        return {
          id: "session-1",
          adminUserId: activeUser.id,
          tokenHash: sessionTokenHash,
          csrfTokenHash,
          absoluteExpiresAt: new Date(Date.now() + 3600000),
          revokedAt: null,
          adminUser: activeUser,
        };
      }
      return null;
    },
    async updateMany() {
      return { count: 1 };
    },
  };

  const realRequireAdmin = createRequireAdmin({
    prismaClient: mockPrisma,
    isProduction: false,
  });

  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: mockPrisma,
    requireAdminMiddleware: realRequireAdmin,
  });
  app.use("/api/admin/enquiries", router);

  return { app, sessionToken, csrfToken, mockPrisma };
}

test("Route-level security — requireAdmin rejects non-admin role (EDITOR) with 403 Administrator access required", async () => {
  const { app, sessionToken } = setupRealSecurityRouter("EDITOR");
  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/`, {
      headers: { Cookie: `admin_session=${sessionToken}` },
    });
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.message, "Administrator access required.");
  } finally {
    await testServer.close();
  }
});

test("Route-level security — mutating endpoints reject requests with missing CSRF token with 403 CSRF validation failed", async () => {
  const { app, sessionToken, csrfToken } = setupRealSecurityRouter("ADMIN");
  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/sec-enq-1/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
      },
      body: JSON.stringify({ workflowStatus: "IN_PROGRESS" }),
    });
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.message, "CSRF validation failed.");
  } finally {
    await testServer.close();
  }
});

test("Route-level security — mutating endpoints reject requests with mismatched CSRF token with 403 CSRF validation failed", async () => {
  const { app, sessionToken, csrfToken } = setupRealSecurityRouter("ADMIN");
  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/sec-enq-1/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": "invalid-mismatched-token",
      },
      body: JSON.stringify({ workflowStatus: "IN_PROGRESS" }),
    });
    const data = await res.json();
    assert.equal(res.status, 403);
    assert.equal(data.message, "CSRF validation failed.");
  } finally {
    await testServer.close();
  }
});

test("Route-level security — mutating endpoints succeed when valid session cookie and matching X-CSRF-Token header are provided", async () => {
  const { app, sessionToken, csrfToken } = setupRealSecurityRouter("ADMIN");
  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/sec-enq-1/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `admin_session=${sessionToken}; admin_csrf=${csrfToken}`,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ workflowStatus: "IN_PROGRESS" }),
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.data.enquiry.workflowStatus, "IN_PROGRESS");
  } finally {
    await testServer.close();
  }
});

test("Enquiry deletion protection — confirms there is no permanent-delete endpoint", async () => {
  const app = express();
  app.use(express.json());
  const router = createAdminEnquiriesRouter({
    prismaClient: createMockPrisma(),
    requireAdminMiddleware: makePassAdminMiddleware(),
  });
  app.use("/api/admin/enquiries", router);

  const testServer = await startServer(app);
  try {
    const res = await fetch(`${testServer.baseUrl}/some-id`, { method: "DELETE" });
    // Since DELETE is not mounted, Express 404 is returned
    assert.equal(res.status, 404);
  } finally {
    await testServer.close();
  }
});
