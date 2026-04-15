/**
 * Tests for POST /api/portal/property
 * Auth is session-based via getPortalPm(). Token is no longer accepted.
 */
import { NextRequest } from "next/server";

const UUID_PM     = "123e4567-e89b-12d3-a456-426614174201";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174202";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

const mockResendSend = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockResendSend } })),
}));

const mockGetPortalPm = jest.fn();
jest.mock("@/lib/portal", () => ({
  getPortalPm: (...args: any[]) => mockGetPortalPm(...args),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/property/route";

process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_FROM = "noreply@example.com";

const pm = { id: UUID_PM, tenant_id: UUID_TENANT, full_name: "PM User", email: "pm@example.com", is_active: true };

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/portal/property", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chain(result: any) {
  const o: any = {
    select:      jest.fn(() => o),
    insert:      jest.fn(() => o),
    update:      jest.fn(() => o),
    eq:          jest.fn(() => o),
    single:      jest.fn(async () => ({ data: result, error: null })),
    maybeSingle: jest.fn(async () => ({ data: result, error: null })),
  };
  return o;
}

describe("POST /api/portal/property", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPortalPm.mockResolvedValue(pm);

    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "properties":
          return chain({ id: "prop-1", name: "HQ" });
        case "profiles":
          return chain({ email: "owner@example.com", full_name: "Owner" });
        case "tenants":
          return chain({ name: "ACME Construction" });
        default:
          return chain(null);
      }
    });
  });

  it("creates a property and notifies owner", async () => {
    const res = await POST(makeReq({
      name: "HQ",
      address: "1 Main St",
      city: "Springfield",
      state: "IN",
      zip: "12345",
    }) as any);
    expect(res.status).toBe(200);
    expect(mockResendSend).toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetPortalPm.mockResolvedValue(null);

    const res = await POST(makeReq({ name: "HQ", address: "1 Main St", city: "Springfield", state: "IN", zip: "12345" }) as any);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeReq({ name: "HQ" }) as any);
    expect(res.status).toBe(400);
  });
});
