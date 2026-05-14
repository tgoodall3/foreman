/**
 * Tests for POST /api/settings/account
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ createServiceClient: jest.fn(() => ({ from: mockFrom })) }));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

// Pass through real validation so we test the actual schema
jest.mock("@/lib/validation", () => {
  const actual = jest.requireActual("@/lib/validation");
  return { ...actual };
});

import { POST } from "../../app/api/settings/account/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/settings/account", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function buildChain(response: object) {
  const chain: any = {
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

const validBody = { name: "Acme Contractors" };

describe("POST /api/settings/account", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when website is not a valid URL", async () => {
    const res = await POST(makeRequest({ name: "Acme Co", website: "not-a-url" }));
    expect(res.status).toBe(400);
  });

  it("updates account and returns 200", async () => {
    mockFrom.mockImplementation(() => buildChain({ error: null }));
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 500 when database update fails", async () => {
    mockFrom.mockImplementation(() => buildChain({ error: { message: "DB error" } }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("accepts optional fields", async () => {
    mockFrom.mockImplementation(() => buildChain({ error: null }));
    const res = await POST(makeRequest({
      name:           "Acme Co",
      phone:          "555-1234",
      address:        "123 Main St",
      invoice_footer: "Thank you for your business",
      tax_id:         "12-3456789",
      website:        "https://acme.com",
    }));
    expect(res.status).toBe(200);
  });
});
