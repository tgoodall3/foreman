/**
 * Tests for POST /api/portal/submit
 */
import { NextRequest } from "next/server";

const UUID_PM     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174002";
const UUID_PROP   = "123e4567-e89b-12d3-a456-426614174003";
const UUID_WO     = "123e4567-e89b-12d3-a456-426614174004";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRateLimit = jest.fn();
jest.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));

const mockResendSend = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockResendSend } })),
}));

const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
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

const validBody = {
  property_manager_id: UUID_PM,
  tenant_id:           UUID_TENANT,
  property_id:         UUID_PROP,
  title:               "Broken window",
  description:         "Window cracked in unit 3.",
  priority:            "normal",
};

// Helper: build a sequence of mockServiceFrom responses
function makeFromSequence(
  responses: Array<{ data?: any; error?: any }>
) {
  let i = 0;
  mockServiceFrom.mockImplementation(() => {
    const r = responses[i] ?? { data: null, error: null };
    i++;
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
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
    process.env.RESEND_API_KEY = "test-key";
    process.env.EMAIL_FROM     = "noreply@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns 400 for an invalid payload (missing title)", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    const { title, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid priority", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    const res = await POST(makeRequest({ ...validBody, priority: "extreme" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockResolvedValue({ success: false, reset: Date.now() + 3600000 });

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toMatch(/too many/i);
  });

  it("returns 404 when property manager is not found", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([{ data: null, error: null }]); // pm lookup → null

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 404 when property is not found", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([
      { data: { id: UUID_PM, full_name: "Alice PM", email: "alice@pm.com" }, error: null },
      { data: null, error: null }, // property not found
    ]);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("creates work order and returns 200 on success", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([
      { data: { id: UUID_PM, full_name: "Alice PM", email: "alice@pm.com" }, error: null },
      { data: { id: UUID_PROP, name: "Sunrise Apts", address: "100 Main" }, error: null },
      {
        data: {
          id: UUID_WO,
          properties:        { name: "Sunrise Apts", address: "100 Main" },
          property_managers: { full_name: "Alice PM", email: "alice@pm.com" },
        },
        error: null,
      },
      // owner lookup for email
      { data: { email: "owner@gc.com", full_name: "Bob Owner" }, error: null },
    ]);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.id).toBe(UUID_WO);
  });

  it("sends notification emails when work order is created", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([
      { data: { id: UUID_PM, full_name: "Alice PM", email: "alice@pm.com" }, error: null },
      { data: { id: UUID_PROP, name: "Sunrise Apts", address: "100 Main" }, error: null },
      {
        data: {
          id: UUID_WO,
          properties:        { name: "Sunrise Apts", address: "100 Main" },
          property_managers: { full_name: "Alice PM", email: "alice@pm.com" },
        },
        error: null,
      },
      { data: { email: "owner@gc.com", full_name: "Bob Owner" }, error: null },
    ]);

    await POST(makeRequest(validBody));

    // Should have sent two emails: one to owner, one to PM
    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@gc.com" })
    );
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alice@pm.com" })
    );
  });

  it("succeeds without sending emails when RESEND_API_KEY is absent", async () => {
    delete process.env.RESEND_API_KEY;
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([
      { data: { id: UUID_PM, full_name: "Alice PM", email: "alice@pm.com" }, error: null },
      { data: { id: UUID_PROP, name: "Sunrise Apts", address: "100 Main" }, error: null },
      {
        data: {
          id: UUID_WO,
          properties:        { name: "Sunrise Apts", address: "100 Main" },
          property_managers: { full_name: "Alice PM", email: "alice@pm.com" },
        },
        error: null,
      },
      { data: { email: "owner@gc.com", full_name: "Bob Owner" }, error: null },
    ]);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 500 when work order insert fails", async () => {
    mockRateLimit.mockResolvedValue({ success: true, reset: 0 });
    makeFromSequence([
      { data: { id: UUID_PM, full_name: "Alice PM", email: "alice@pm.com" }, error: null },
      { data: { id: UUID_PROP, name: "Sunrise Apts", address: "100 Main" }, error: null },
      { data: null, error: { message: "insert failed" } },
    ]);

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});
