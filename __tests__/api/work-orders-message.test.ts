/**
 * Tests for POST /api/work-orders/message
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_WO     = "123e4567-e89b-12d3-a456-426614174001";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ createServiceClient: jest.fn(() => ({ from: mockFrom })) }));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp:    jest.fn().mockReturnValue("127.0.0.1"),
}));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: jest.fn().mockResolvedValue({}) } })) }));
jest.mock("@/lib/email", () => ({
  getFromAddress:    jest.fn(() => "noreply@test.com"),
  renderEmailLayout: jest.fn(() => "<html/>"),
  renderDetailCard:  jest.fn(() => ""),
  renderNoticeCard:  jest.fn(() => ""),
  renderMessageCard: jest.fn(() => ""),
}));

import { POST } from "../../app/api/work-orders/message/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/work-orders/message", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const validBody = { workOrderId: UUID_WO, message: "Please confirm the date." };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

describe("POST /api/work-orders/message", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when workOrderId is not a UUID", async () => {
    const res = await POST(makeRequest({ workOrderId: "not-a-uuid", message: "Hi" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is empty", async () => {
    const res = await POST(makeRequest({ workOrderId: UUID_WO, message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when work order not found or wrong tenant", async () => {
    mockFrom.mockImplementation(() => buildChain({ data: null, error: null }));
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(404);
  });

  it("returns 404 when work order belongs to different tenant", async () => {
    mockFrom.mockImplementation(() => buildChain({
      data: { id: UUID_WO, title: "Fix fence", tenant_id: "other-tenant", property_managers: null, properties: null },
      error: null,
    }));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 200 when work order is found (no email config)", async () => {
    // Without RESEND_API_KEY in env, email is skipped
    mockFrom.mockImplementation(() => buildChain({
      data: { id: UUID_WO, title: "Fix fence", tenant_id: UUID_TENANT, property_manager_id: "pm-1", properties: { name: "HQ" }, property_managers: { full_name: "Jane", email: null, portal_token: null } },
      error: null,
    }));
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
