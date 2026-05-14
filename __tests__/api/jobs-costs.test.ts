/**
 * Tests for GET/POST /api/jobs/[id]/costs
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174001";
const UUID_COST   = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

import { GET, POST } from "../../app/api/jobs/[id]/costs/route";

function makeGet() {
  return new NextRequest(`http://localhost/api/jobs/${UUID_JOB}/costs`, { method: "GET" });
}
function makePost(body: object) {
  return new NextRequest(`http://localhost/api/jobs/${UUID_JOB}/costs`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const params = { params: { id: UUID_JOB } };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
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

describe("GET /api/jobs/[id]/costs", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 200 with empty costs array", async () => {
    setFromSequence([{ data: [], error: null }]);
    const res  = await GET(makeGet(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.costs).toEqual([]);
  });

  it("returns 200 with list of costs", async () => {
    const costs = [
      { id: UUID_COST, type: "material", description: "Lumber", amount: 250, created_at: "2025-01-01T00:00:00Z" },
    ];
    setFromSequence([{ data: costs, error: null }]);
    const res  = await GET(makeGet(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.costs).toHaveLength(1);
    expect(json.costs[0].type).toBe("material");
  });
});

describe("POST /api/jobs/[id]/costs", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 for invalid cost type", async () => {
    const res = await POST(makePost({ type: "unknown", description: "Paint", amount: 100 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is empty", async () => {
    const res = await POST(makePost({ type: "material", description: "", amount: 100 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when amount is negative", async () => {
    const res = await POST(makePost({ type: "material", description: "Paint", amount: -50 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when job not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await POST(makePost({ type: "material", description: "Paint", amount: 100 }), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/job not found/i);
  });

  it("creates cost and returns 201", async () => {
    const newCost = { id: UUID_COST, type: "material", description: "Paint", amount: 100, created_at: "2025-01-01T00:00:00Z" };
    setFromSequence([
      { data: { id: UUID_JOB }, error: null },      // job verify
      { data: newCost, error: null },                // insert
    ]);
    const res  = await POST(makePost({ type: "material", description: "Paint", amount: 100 }), params);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.cost.type).toBe("material");
  });

  it("accepts all valid cost types", async () => {
    for (const type of ["material", "subcontractor", "equipment", "other"]) {
      setFromSequence([
        { data: { id: UUID_JOB }, error: null },
        { data: { id: UUID_COST, type, description: "Test", amount: 50, created_at: "2025-01-01" }, error: null },
      ]);
      const res = await POST(makePost({ type, description: "Test", amount: 50 }), params);
      expect(res.status).toBe(201);
    }
  });

  it("rounds amount to 2 decimal places", async () => {
    let insertPayload: any = null;
    callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return buildChain({ data: { id: UUID_JOB }, error: null });
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        order:  jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: UUID_COST, type: "material", description: "X", amount: 99.99, created_at: "" }, error: null }),
        insert: jest.fn().mockImplementation((p: any) => { insertPayload = p; return chain; }),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve({ data: insertPayload, error: null }).then(res, rej);
      return chain;
    });
    await POST(makePost({ type: "material", description: "Test", amount: 99.999 }), params);
    expect(insertPayload.amount).toBe(100);
  });
});
