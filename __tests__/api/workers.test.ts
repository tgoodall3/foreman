/**
 * Tests for worker management routes:
 *   POST  /api/workers/toggle
 *   POST  /api/workers/invite
 *   PATCH /api/workers/[id]/rate
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_WORKER = "123e4567-e89b-12d3-a456-426614174001";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

jest.mock("@/lib/plan", () => ({ checkPlanForApi: jest.fn().mockResolvedValue(null) }));

const mockServiceFrom = jest.fn();
const mockAdminCreateUser = jest.fn();
const mockAdminDeleteUser = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({
    from: mockServiceFrom,
    auth: { admin: { createUser: mockAdminCreateUser, deleteUser: mockAdminDeleteUser } },
  })),
}));

const mockServerFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockServerFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

jest.mock("@/lib/validation", () => {
  const actual = jest.requireActual("@/lib/validation");
  return { ...actual };
});

import { POST as toggleWorker }  from "../../app/api/workers/toggle/route";
import { POST as inviteWorker }  from "../../app/api/workers/invite/route";
import { PATCH as updateRate }   from "../../app/api/workers/[id]/rate/route";

function makeRequest(url: string, method: string, body: object) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const rateParams = { params: { id: UUID_WORKER } };

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
function setServiceFromSequence(responses: object[]) {
  callCount = 0;
  mockServiceFrom.mockImplementation(() => buildChain(responses[callCount++] ?? { data: null, error: null }));
}

function setServerFromSequence(responses: object[]) {
  callCount = 0;
  mockServerFrom.mockImplementation(() => buildChain(responses[callCount++] ?? { data: null, error: null }));
}

// ===========================================================================
// Toggle
// ===========================================================================
describe("POST /api/workers/toggle", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { workerId: UUID_WORKER, isActive: false }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when workerId is missing", async () => {
    const res = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { isActive: true }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when worker not found or wrong tenant", async () => {
    setServiceFromSequence([{ data: null, error: null }]);
    const res  = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { workerId: UUID_WORKER, isActive: false }));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 404 when worker belongs to different tenant", async () => {
    setServiceFromSequence([{ data: { tenant_id: "other-tenant" }, error: null }]);
    const res  = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { workerId: UUID_WORKER, isActive: false }));
    expect(res.status).toBe(404);
  });

  it("deactivates worker successfully", async () => {
    setServiceFromSequence([
      { data: { tenant_id: UUID_TENANT }, error: null },  // verify
      { data: {}, error: null },                          // update
    ]);
    const res  = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { workerId: UUID_WORKER, isActive: false }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("activates worker successfully", async () => {
    setServiceFromSequence([
      { data: { tenant_id: UUID_TENANT }, error: null },
      { data: {}, error: null },
    ]);
    const res  = await toggleWorker(makeRequest("/api/workers/toggle", "POST", { workerId: UUID_WORKER, isActive: true }));
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// Invite
// ===========================================================================
describe("POST /api/workers/invite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: UUID_WORKER } }, error: null });
    mockAdminDeleteUser.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await inviteWorker(makeRequest("/api/workers/invite", "POST", { tenantId: UUID_TENANT, fullName: "Bob", email: "bob@test.com", password: "pass1234" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when email is missing", async () => {
    const res = await inviteWorker(makeRequest("/api/workers/invite", "POST", { tenantId: UUID_TENANT, fullName: "Bob", password: "pass1234" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when tenantId does not match owner", async () => {
    const res = await inviteWorker(makeRequest("/api/workers/invite", "POST", {
      tenantId: "99999999-9999-4999-8999-999999999999",
      fullName: "Bob", email: "bob@test.com", password: "pass1234",
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for duplicate email", async () => {
    mockAdminCreateUser.mockResolvedValue({ data: null, error: { message: "User already registered" } });
    const res  = await inviteWorker(makeRequest("/api/workers/invite", "POST", {
      tenantId: UUID_TENANT, fullName: "Bob", email: "existing@test.com", password: "pass1234",
    }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already exists/i);
  });

  it("creates worker profile and returns it", async () => {
    const profile = { id: UUID_WORKER, tenant_id: UUID_TENANT, email: "bob@test.com", full_name: "Bob", role: "worker" };
    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: UUID_WORKER } }, error: null });
    setServiceFromSequence([{ data: profile, error: null }]);

    const res  = await inviteWorker(makeRequest("/api/workers/invite", "POST", {
      tenantId: UUID_TENANT, fullName: "Bob", email: "bob@test.com", password: "pass1234",
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.profile.full_name).toBe("Bob");
  });

  it("rolls back auth user when profile insert fails", async () => {
    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: UUID_WORKER } }, error: null });
    setServiceFromSequence([{ data: null, error: { message: "insert failed" } }]);

    const res = await inviteWorker(makeRequest("/api/workers/invite", "POST", {
      tenantId: UUID_TENANT, fullName: "Bob", email: "bob@test.com", password: "pass1234",
    }));
    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledWith(UUID_WORKER);
  });
});

// ===========================================================================
// Rate
// ===========================================================================
describe("PATCH /api/workers/[id]/rate", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 when rate is negative", async () => {
    const req = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: -10 });
    const res = await updateRate(req, rateParams);
    expect(res.status).toBe(400);
  });

  it("returns 400 when rate is not a number", async () => {
    const req = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: "abc" });
    const res = await updateRate(req, rateParams);
    expect(res.status).toBe(400);
  });

  it("returns 400 when worker not found", async () => {
    setServerFromSequence([{ data: null, error: null }]);
    const req  = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: 25 });
    const res  = await updateRate(req, rateParams);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/worker not found/i);
  });

  it("updates rate to a valid number", async () => {
    setServerFromSequence([
      { data: { id: UUID_WORKER }, error: null },  // verify
      { data: {}, error: null },                   // update
    ]);
    const req  = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: 35 });
    const res  = await updateRate(req, rateParams);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("allows setting rate to null (clear rate)", async () => {
    setServerFromSequence([
      { data: { id: UUID_WORKER }, error: null },
      { data: {}, error: null },
    ]);
    const req = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: null });
    const res = await updateRate(req, rateParams);
    expect(res.status).toBe(200);
  });

  it("allows setting rate to 0", async () => {
    setServerFromSequence([
      { data: { id: UUID_WORKER }, error: null },
      { data: {}, error: null },
    ]);
    const req = makeRequest(`/api/workers/${UUID_WORKER}/rate`, "PATCH", { hourly_rate: 0 });
    const res = await updateRate(req, rateParams);
    expect(res.status).toBe(200);
  });
});
