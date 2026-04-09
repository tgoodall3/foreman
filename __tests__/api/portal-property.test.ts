/**
 * Tests for POST /api/portal/property
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

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/property/route";

process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_FROM = "noreply@example.com";

function makeReq(body: object) {
  return new NextRequest("http://localhost/api/portal/property", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portal/property", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "property_managers":
          return chain({ id: UUID_PM, tenant_id: UUID_TENANT, full_name: "PM", email: "pm@example.com" });
        case "properties":
          return chain({ id: "prop-1" });
        case "profiles":
          return chain({ email: "owner@example.com", full_name: "Owner" });
        default:
          return chain(null);
      }
    });
  });

  it("creates a property via portal token and notifies owner", async () => {
    const res = await POST(makeReq({
      token: "tok1234567890",
      name: "HQ",
      address: "1 Main St",
      city: "Springfield",
      state: "IN",
      zip: "12345",
    }) as any);
    expect(res.status).toBe(200);
    expect(mockResendSend).toHaveBeenCalled();
  });
});

// simple chainable supabase stub
function chain(result: any) {
  const o: any = {
    select: jest.fn(() => o),
    insert: jest.fn(() => o),
    update: jest.fn(() => o),
    eq: jest.fn(() => o),
    single: jest.fn(async () => ({ data: result })),
    maybeSingle: jest.fn(async () => ({ data: result })),
  };
  return o;
}
