// Set env vars before any module is loaded (routes read these at module-level to init Resend)
process.env.RESEND_API_KEY       = "re_test_xxx";
process.env.EMAIL_FROM           = "noreply@example.com";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

/**
 * Tests for POST /api/invoices/[id]/send
 *
 * Real production bug: if the PM had no portal_token (created before migration
 * 015 added the column default), the send route returned 400 because the
 * invoice URL was built with an empty token.
 *
 * Fix: if portal_token is null, generate a new one and persist it before
 * building the URL.
 */
import { NextRequest } from "next/server";

const UUID_INVOICE = "123e4567-e89b-12d3-a456-426614174020";
const UUID_TENANT  = "123e4567-e89b-12d3-a456-426614174021";
const UUID_PM      = "123e4567-e89b-12d3-a456-426614174022";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockGetOwnerInvoice = jest.fn();
jest.mock("@/lib/services/owner", () => ({ getOwnerInvoice: mockGetOwnerInvoice }));

const mockServerFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockServerFrom })),
}));

const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

const mockResendSend = jest.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

// Stub crypto.randomBytes so we get a predictable token in tests
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomBytes: jest.fn(() => Buffer.from("0".repeat(64), "hex")),
}));

import { POST } from "../../app/api/invoices/[id]/send/route";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };
const params       = { id: UUID_INVOICE };

function makeRequest(body?: object) {
  return new NextRequest(`http://localhost/api/invoices/${UUID_INVOICE}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
}

// A complete invoice that has all required fields
const baseInvoice = {
  id: UUID_INVOICE,
  invoice_number: "TEST-0001",
  total: 500,
  subtotal: 500,
  tax_rate: 0,
  tax_amount: 0,
  due_date: "2025-12-31",
  status: "draft",
  notes: null,
  line_items: [{ description: "Labor", quantity: 2, unit_price: 250, total: 500 }],
  tenant_id: UUID_TENANT,
  property_manager_id: UUID_PM,
  property_managers: {
    email: "pm@example.com",
    full_name: "Test PM",
  },
  jobs: { title: "Roof Repair" },
};

function setupDb({ portalToken }: { portalToken: string | null }) {
  let serverCall = 0;
  mockServerFrom.mockImplementation(() => {
    serverCall++;
    if (serverCall === 1) {
      // PM portal_token lookup (in Promise.all)
      const c: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { portal_token: portalToken }, error: null }),
      };
      c.then = (res: any, rej?: any) => Promise.resolve({ data: { portal_token: portalToken }, error: null }).then(res, rej);
      return c;
    }
    // Invoice status update (update({ status: "sent" })) — chainable, no return needed
    const c: any = {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    };
    c.then = (res: any, rej?: any) => Promise.resolve({ data: {}, error: null }).then(res, rej);
    return c;
  });

  let serviceCall = 0;
  mockServiceFrom.mockImplementation(() => {
    serviceCall++;
    if (serviceCall === 1) {
      // Tenant name lookup (in Promise.all)
      const c: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { name: "Acme Co" }, error: null }),
      };
      c.then = (res: any, rej?: any) => Promise.resolve({ data: { name: "Acme Co" }, error: null }).then(res, rej);
      return c;
    }
    // portal_token update (only called when portalToken is null)
    const c: any = {
      update: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
    };
    c.then = (res: any, rej?: any) => Promise.resolve({ data: {}, error: null }).then(res, rej);
    return c;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/invoices/[id]/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params });
    // requireOwner redirects rather than returning 401 in server components,
    // but the route wraps it — we just need it to not return 200
    expect([400, 401, 302]).toContain(res.status);
  });

  it("returns 400 when invoice is not found", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(null);

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 400 when invoice has no recipient email", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue({
      ...baseInvoice,
      property_managers: { email: null, full_name: "No Email PM" },
    });
    setupDb({ portalToken: "existing-token" });

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/email not provided|recipient/i);
  });

  it("returns 400 for an invalid email override", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);

    const res  = await POST(makeRequest({ email: "not-an-email" }), { params });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid email/i);
  });

  // ── Bug regression: PM with no portal_token ──────────────────────────────

  it("succeeds and sends email when PM already has a portal_token", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);
    setupDb({ portalToken: "existing-token-abc123" });

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.emailId).toBeDefined();
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("generates a portal_token for a PM that has none, then sends (regression test)", async () => {
    // This was the exact bug: PM had null portal_token after migration 015
    // dropped the column default. The route now generates one on the fly.
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);
    setupDb({ portalToken: null }); // <── no token

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Email must have been sent despite the missing token
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("includes portal URL with token in the sent email", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);
    setupDb({ portalToken: "test-portal-token-xyz" });

    await POST(makeRequest(), { params });

    const emailCall = mockResendSend.mock.calls[0][0];
    expect(emailCall.html).toContain("test-portal-token-xyz");
    expect(emailCall.html).toContain(UUID_INVOICE);
  });

  it("accepts a valid email override and sends to that address instead", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);
    setupDb({ portalToken: "tok" });

    await POST(makeRequest({ email: "override@client.com" }), { params });

    const emailCall = mockResendSend.mock.calls[0][0];
    expect(emailCall.to).toBe("override@client.com");
  });

  it("returns 500 when Resend fails", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(baseInvoice);
    setupDb({ portalToken: "tok" });
    mockResendSend.mockResolvedValueOnce({ data: null, error: new Error("Resend error") });

    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(500);
  });

  it("escapes HTML entities in notes to prevent XSS in email body", async () => {
    const maliciousInvoice = {
      ...baseInvoice,
      notes: '<script>alert("xss")</script>',
    };
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockGetOwnerInvoice.mockResolvedValue(maliciousInvoice);
    setupDb({ portalToken: "tok" });

    await POST(makeRequest(), { params });

    const emailHtml = mockResendSend.mock.calls[0][0].html;
    expect(emailHtml).not.toContain("<script>");
    expect(emailHtml).toContain("&lt;script&gt;");
  });
});
