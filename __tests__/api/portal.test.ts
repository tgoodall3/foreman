/**
 * Tests for POST /api/portal/submit
 * Auth is session-based via getPortalPm(). Identity is never client-supplied.
 */
import { NextRequest } from "next/server";

const UUID_PM     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174002";
const UUID_PROP   = "123e4567-e89b-12d3-a456-426614174003";
const UUID_WO     = "123e4567-e89b-12d3-a456-426614174004";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockResendSend = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockResendSend } })),
}));

const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

const mockGetPortalPm = jest.fn();
jest.mock("@/lib/portal", () => ({
  getPortalPm: (...args: any[]) => mockGetPortalPm(...args),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/submit/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/portal/submit", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

// property_manager_id and tenant_id are no longer client-supplied
const validBody = {
  property_id:  UUID_PROP,
  title:        "Broken window",
  description:  "Window cracked in unit 3.",
  priority:     "normal",
};

const PM    = { id: UUID_PM, tenant_id: UUID_TENANT, full_name: "Alice PM", email: "alice@pm.com", is_active: true };
const PROP  = { id: UUID_PROP, name: "Sunrise Apts", address: "100 Main" };
const WO    = {
  id: UUID_WO,
  properties:        { name: "Sunrise Apts", address: "100 Main" },
  property_managers: { full_name: "Alice PM", email: "alice@pm.com" },
};
const OWNER = { email: "owner@gc.com", full_name: "Bob Owner" };

/**
 * Build a sequence of mockServiceFrom responses.
 * DB call order in the route:
 *   1. work_orders count  (rate limit check)
 *   2. properties         (property ownership check)
 *   3. work_orders insert
 *   4+. profiles + tenants (Promise.all for email)
 */
function makeFromSequence(
  responses: Array<{ data?: any; error?: any; count?: number }>,
  rateLimitCount = 0,
) {
  const full = [{ data: null, error: null, count: rateLimitCount }, ...responses];
  let i = 0;
  mockServiceFrom.mockImplementation(() => {
    const r = full[i] ?? { data: null, error: null, count: 0 };
    i++;
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(r),
    };
    chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
    return chain;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/portal/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPortalPm.mockResolvedValue(PM);
    process.env.RESEND_API_KEY       = "test-key";
    process.env.EMAIL_FROM           = "noreply@example.com";
    process.env.NEXT_PUBLIC_APP_URL  = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns 401 when not authenticated", async () => {
    mockGetPortalPm.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid payload (missing title)", async () => {
    const { title, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid priority", async () => {
    const res = await POST(makeRequest({ ...validBody, priority: "extreme" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when PM has >= 5 submissions in the last hour", async () => {
    makeFromSequence([], 5);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toMatch(/too many/i);
  });

  it("returns 404 when property is not found or does not belong to PM", async () => {
    makeFromSequence([{ data: null, error: null }]);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("scopes the property lookup to the submitting PM", async () => {
    const propertyEq = jest.fn();
    let callCount = 0;

    mockServiceFrom.mockImplementation(() => {
      callCount++;

      // call 1: rate limit check
      if (callCount === 1) {
        const r = { data: null, error: null, count: 0 };
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(r),
        };
        chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
        return chain;
      }

      // call 2: property lookup — spy on eq calls
      const r = { data: null, error: null };
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockImplementation((field: string, value: any) => {
          propertyEq(field, value);
          return chain;
        }),
        single: jest.fn().mockResolvedValue(r),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
      return chain;
    });

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(404);
    expect(propertyEq).toHaveBeenCalledWith("property_manager_id", UUID_PM);
  });

  it("creates work order and returns 200 on success", async () => {
    makeFromSequence([
      { data: PROP,              error: null },
      { data: WO,                error: null },
      { data: OWNER,             error: null },
      { data: { name: "Acme GC" }, error: null },
    ]);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe(UUID_WO);
  });

  it("sends notification emails when work order is created", async () => {
    makeFromSequence([
      { data: PROP,              error: null },
      { data: WO,                error: null },
      { data: OWNER,             error: null },
      { data: { name: "Acme GC" }, error: null },
    ]);

    await POST(makeRequest(validBody));

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@gc.com" })
    );
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alice@pm.com" })
    );
  });

  it("succeeds without sending emails when RESEND_API_KEY is absent", async () => {
    delete process.env.RESEND_API_KEY;
    makeFromSequence([
      { data: PROP,              error: null },
      { data: WO,                error: null },
      { data: OWNER,             error: null },
      { data: { name: "Acme GC" }, error: null },
    ]);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 500 when work order insert fails", async () => {
    makeFromSequence([
      { data: PROP, error: null },
      { data: null, error: { message: "insert failed" } },
    ]);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
