/**
 * Tests for PATCH /api/jobs/[id]/assign
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174001";
const UUID_W1     = "123e4567-e89b-12d3-a456-426614174002";
const UUID_W2     = "123e4567-e89b-12d3-a456-426614174003";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetProfile = jest.fn();
jest.mock("@/lib/auth", () => ({ getProfile: mockGetProfile }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { PATCH } from "../../app/api/jobs/[id]/assign/route";

function makeRequest(body: object) {
  return new NextRequest(`http://localhost/api/jobs/${UUID_JOB}/assign`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const params = { params: { id: UUID_JOB } };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    in:     jest.fn().mockReturnThis(),
    head:   jest.fn().mockReturnThis(),
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

describe("PATCH /api/jobs/[id]/assign", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetProfile.mockResolvedValue(ownerProfile); });

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await PATCH(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is not owner", async () => {
    mockGetProfile.mockResolvedValue({ ...ownerProfile, role: "worker" });
    const res = await PATCH(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when job not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await PATCH(makeRequest({ scheduled_date: "2025-06-01" }), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/job not found/i);
  });

  it("returns 400 when a worker ID does not belong to this tenant", async () => {
    setFromSequence([
      { data: { id: UUID_JOB, tenant_id: UUID_TENANT }, error: null },  // job
      { count: 1, error: null },  // only 1 of 2 workers found
    ]);
    const res  = await PATCH(makeRequest({ assigned_workers: [UUID_W1, UUID_W2] }), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/workers not found/i);
  });

  it("assigns workers and updates schedule successfully", async () => {
    setFromSequence([
      { data: { id: UUID_JOB, tenant_id: UUID_TENANT }, error: null },
      { count: 2, error: null },   // both workers verified
      { data: {}, error: null },   // update
    ]);
    const res  = await PATCH(makeRequest({ assigned_workers: [UUID_W1, UUID_W2], scheduled_date: "2025-06-01" }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("updates schedule with no workers specified", async () => {
    setFromSequence([
      { data: { id: UUID_JOB, tenant_id: UUID_TENANT }, error: null },
      { data: {}, error: null },
    ]);
    const res  = await PATCH(makeRequest({ scheduled_date: "2025-07-15", scheduled_time: "09:00" }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
