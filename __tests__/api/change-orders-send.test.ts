/**
 * Tests for POST /api/change-orders/[id]/send
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_CO     = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockServerFrom  = jest.fn();
const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockServerFrom })),
}));
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
jest.mock("@/lib/utils", () => ({ formatCurrency: jest.fn((n: number) => `$${n}`) }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp:    jest.fn().mockReturnValue("127.0.0.1"),
}));

const mockEmailSend = jest.fn().mockResolvedValue({ error: null });
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockEmailSend } })),
}));

process.env.RESEND_API_KEY      = "test-key";
process.env.EMAIL_FROM          = "test@example.com";
process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";

import { POST } from "../../app/api/change-orders/[id]/send/route";

function makeRequest() {
  return new NextRequest(`http://localhost/api/change-orders/${UUID_CO}/send`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({}),
  });
}

const params = { params: { id: UUID_CO } };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

const goodCO = {
  id: UUID_CO,
  tenant_id: UUID_TENANT,
  status: "draft",
  change_order_number: "ACME-0001",
  title: "Extra work",
  description: "Replaced fence",
  line_items: [{ description: "Fence", quantity: 1, unit_price: 500, total: 500 }],
  subtotal: 500,
  tax_rate: 0,
  tax_amount: 0,
  total: 500,
  notes: null,
  property_manager_id: "pm-1",
  approval_token: "tok123",
  property_managers: { full_name: "Jane PM", email: "jane@pm.com" },
  jobs: { title: "Fix fence" },
};

describe("POST /api/change-orders/[id]/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockEmailSend.mockResolvedValue({ error: null });
  });

  it("returns 400 when change order is not found", async () => {
    let call = 0;
    mockServerFrom.mockImplementation(() => buildChain(call++ === 0
      ? { data: null, error: null }
      : { data: { name: "Acme Co" }, error: null }
    ));
    mockServiceFrom.mockImplementation(() => buildChain({ data: { name: "Acme Co" }, error: null }));

    const res  = await POST(makeRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 400 when change order has no property manager", async () => {
    const coNoPm = { ...goodCO, property_manager_id: null };
    let call = 0;
    mockServerFrom.mockImplementation(() => buildChain(call++ === 0
      ? { data: coNoPm, error: null }
      : { data: {}, error: null }
    ));
    mockServiceFrom.mockImplementation(() => buildChain({ data: { name: "Acme Co" }, error: null }));

    const res  = await POST(makeRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/no property manager/i);
  });

  it("returns 400 when change order is already approved", async () => {
    const coApproved = { ...goodCO, status: "approved" };
    let call = 0;
    mockServerFrom.mockImplementation(() => buildChain(call++ === 0
      ? { data: coApproved, error: null }
      : { data: {}, error: null }
    ));
    mockServiceFrom.mockImplementation(() => buildChain({ data: { name: "Acme Co" }, error: null }));

    const res  = await POST(makeRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already been approved/i);
  });

  it("sends email and returns 200 on success", async () => {
    let serverCall = 0;
    mockServerFrom.mockImplementation(() => {
      serverCall++;
      if (serverCall === 1) return buildChain({ data: goodCO, error: null });
      return buildChain({ data: {}, error: null }); // update status
    });
    mockServiceFrom.mockImplementation(() => buildChain({ data: { name: "Acme Co" }, error: null }));

    const res  = await POST(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });
});
