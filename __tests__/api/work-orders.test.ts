/**
 * Tests for POST /api/work-orders/action
 */
import { NextRequest } from "next/server";

const UUID_WO     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174002";
const UUID_PROP   = "123e4567-e89b-12d3-a456-426614174003";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174004";

// ---------------------------------------------------------------------------
// Mocks (must be set up before the route is imported)
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireOwner: mockRequireOwner,
}));

// Default to active plan; individual tests can override
jest.mock("@/lib/plan", () => ({
  checkPlanForApi: jest.fn().mockResolvedValue(null),
}));

const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

// next/headers is used transitively; provide a stub so imports don't crash
jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/work-orders/action/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/work-orders/action", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

const validAccept = {
  workOrderId: UUID_WO,
  tenantId:    UUID_TENANT,
  action:      "accept",
  title:       "Fix roof",
  description: "Leak in unit 3",
};

const validDecline = {
  workOrderId: UUID_WO,
  tenantId:    UUID_TENANT,
  action:      "decline",
};

// ---------------------------------------------------------------------------
// Helpers to build fluent mock chains
// ---------------------------------------------------------------------------
function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/work-orders/action", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(validAccept));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid action", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    const res = await POST(
      makeRequest({ ...validAccept, action: "approve" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when tenantId does not match owner's tenant", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    const res = await POST(
      makeRequest({ ...validAccept, tenantId: "other-tenant-id-here-00000000000" })
    );
    // "other-tenant-id-here-00000000000" is not a valid UUID so validation fails first
    expect([400, 403]).toContain(res.status);
  });

  it("returns 403 when a valid tenant UUID does not match", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    const differentTenant = "123e4567-e89b-12d3-a456-426614174099";
    const res  = await POST(
      makeRequest({ ...validAccept, tenantId: differentTenant })
    );
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error).toMatch(/access denied/i);
  });

  it("returns 404 when work order is not found (decline)", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockServiceFrom.mockReturnValue(
      buildChain({ data: null, error: null }) // work order lookup returns null
    );

    const res = await POST(makeRequest(validDecline));
    expect(res.status).toBe(404);
  });

  it("declines a work order and returns 200", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Tenant name fetch
        return buildChain({ data: { name: "Acme Contracting" }, error: null });
      }
      if (callCount === 2) {
        // Work order exists
        return buildChain({ data: { id: UUID_WO, title: "Fix roof" }, error: null });
      }
      // Update work order
      return buildChain({ data: {}, error: null });
    });

    const res  = await POST(makeRequest(validDecline));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 404 when work order is not found (accept)", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockServiceFrom.mockReturnValue(
      buildChain({ data: null, error: null })
    );

    const res = await POST(makeRequest(validAccept));
    expect(res.status).toBe(404);
  });

  it("accepts a work order, creates a job, and returns jobId", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Tenant name fetch
        return buildChain({ data: { name: "Acme Contracting" }, error: null });
      }
      if (callCount === 2) {
        // Work order lookup
        return buildChain({
          data: { title: "Fix roof", description: "Leak", property_id: UUID_PROP },
          error: null,
        });
      }
      if (callCount === 3) {
        // Job insert — must support .insert().select().single()
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: UUID_JOB }, error: null }),
        };
      }
      // Work order status update
      return buildChain({ data: {}, error: null });
    });

    const res  = await POST(makeRequest(validAccept));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBe(UUID_JOB);
  });

  it("returns 500 when job insert fails", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);

    let callCount = 0;
    mockServiceFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Tenant name fetch
        return buildChain({ data: { name: "Acme Contracting" }, error: null });
      }
      if (callCount === 2) {
        return buildChain({
          data: { title: "Fix roof", description: "Leak", property_id: UUID_PROP },
          error: null,
        });
      }
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error("insert failed") }),
      };
    });

    const res = await POST(makeRequest(validAccept));
    expect(res.status).toBe(500);
  });
});
