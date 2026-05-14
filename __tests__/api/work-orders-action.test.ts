/**
 * Tests for POST /api/work-orders/action (accept / decline)
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_WO     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

jest.mock("@/lib/plan", () => ({ checkPlanForApi: jest.fn().mockResolvedValue(null) }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ createServiceClient: jest.fn(() => ({ from: mockFrom })) }));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
jest.mock("@/lib/audit", () => ({ audit: jest.fn() }));
jest.mock("resend", () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: jest.fn().mockResolvedValue({}) } })) }));
jest.mock("@/lib/email", () => ({
  getFromAddress:    jest.fn(() => "noreply@test.com"),
  renderEmailLayout: jest.fn(() => "<html/>"),
  renderNoticeCard:  jest.fn(() => ""),
  renderDetailCard:  jest.fn(() => ""),
  renderMessageCard: jest.fn(() => ""),
}));

// Provide the schema used in the route
jest.mock("@/lib/validation", () => ({
  validateInput: jest.fn((schema: any, data: any) => {
    const result = schema.safeParse(data);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: result.error.issues[0]?.message || "Invalid" };
  }),
  workOrderActionSchema: require("zod").z.object({
    workOrderId:  require("zod").z.string().uuid(),
    tenantId:     require("zod").z.string().uuid(),
    action:       require("zod").z.enum(["accept", "decline"]),
    title:        require("zod").z.string().optional(),
    description:  require("zod").z.string().optional(),
    propertyId:   require("zod").z.string().uuid().optional(),
  }),
}));

import { POST } from "../../app/api/work-orders/action/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/work-orders/action", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const acceptBody = { workOrderId: UUID_WO, tenantId: UUID_TENANT, action: "accept" };
const declineBody = { workOrderId: UUID_WO, tenantId: UUID_TENANT, action: "decline" };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

let callCount = 0;
function setFromSequence(responses: object[]) {
  callCount = 0;
  mockFrom.mockImplementation(() => buildChain(responses[callCount++] ?? { data: null, error: null }));
}

describe("POST /api/work-orders/action", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(acceptBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when tenantId does not match", async () => {
    const res = await POST(makeRequest({ ...acceptBody, tenantId: "99999999-9999-4999-8999-999999999999" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid action", async () => {
    const res = await POST(makeRequest({ ...acceptBody, action: "approve" }));
    expect(res.status).toBe(400);
  });

  // ----- decline -----
  it("decline: returns 404 when work order not found", async () => {
    setFromSequence([
      { data: { name: "Acme" }, error: null },  // tenant
      { data: null, error: null },               // wo not found
    ]);
    const res  = await POST(makeRequest(declineBody));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  it("decline: sets status to declined and returns 200", async () => {
    setFromSequence([
      { data: { name: "Acme" }, error: null },
      { data: { id: UUID_WO, title: "Broken gate", property_managers: { email: null } }, error: null },
      { data: {}, error: null },  // update
    ]);
    const res  = await POST(makeRequest(declineBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  // ----- accept -----
  it("accept: returns 404 when work order not found", async () => {
    setFromSequence([
      { data: { name: "Acme" }, error: null },
      { data: null, error: null },
    ]);
    const res  = await POST(makeRequest(acceptBody));
    const json = await res.json();
    expect(res.status).toBe(404);
  });

  it("accept: returns 409 when work order is not pending", async () => {
    setFromSequence([
      { data: { name: "Acme" }, error: null },
      { data: { id: UUID_WO, status: "accepted", title: "Gate repair", property_managers: {}, properties: {} }, error: null },
    ]);
    const res  = await POST(makeRequest(acceptBody));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toMatch(/not pending/i);
  });

  it("accept: creates job and returns jobId on success", async () => {
    setFromSequence([
      { data: { name: "Acme" }, error: null },
      { data: { id: UUID_WO, status: "pending", title: "Gate repair", description: "Fix it", property_id: "prop-1", priority: "normal", property_manager_id: "pm-1", properties: { name: "HQ" }, property_managers: { full_name: "Jane", email: null, portal_token: null } }, error: null },
      { data: { id: UUID_JOB }, error: null },  // insert job
      { data: {}, error: null },                // update WO
    ]);
    const res  = await POST(makeRequest(acceptBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBe(UUID_JOB);
  });
});
