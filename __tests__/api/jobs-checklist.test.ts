/**
 * Tests for POST/PATCH/DELETE /api/jobs/[id]/checklist
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174001";
const UUID_ITEM   = "123e4567-e89b-12d3-a456-426614174002";
const UUID_WORKER = "123e4567-e89b-12d3-a456-426614174003";

const ownerProfile  = { id: "owner-1",    tenant_id: UUID_TENANT, role: "owner" };
const workerProfile = { id: UUID_WORKER,  tenant_id: UUID_TENANT, role: "worker" };

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
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

import { POST, PATCH, DELETE } from "../../app/api/jobs/[id]/checklist/route";

function makeRequest(method: string, body: object) {
  return new NextRequest(`http://localhost/api/jobs/${UUID_JOB}/checklist`, {
    method,
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const params = { params: { id: UUID_JOB } };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
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

// ---------------------------------------------------------------------------
// POST — add item
// ---------------------------------------------------------------------------
describe("POST /api/jobs/[id]/checklist", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetProfile.mockResolvedValue(ownerProfile); });

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { text: "Buy materials" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is not owner", async () => {
    mockGetProfile.mockResolvedValue(workerProfile);
    const res = await POST(makeRequest("POST", { text: "Buy materials" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is empty", async () => {
    const res = await POST(makeRequest("POST", { text: "" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when job not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await POST(makeRequest("POST", { text: "Buy materials" }), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/job not found/i);
  });

  it("adds item and returns 201 with item data", async () => {
    const newItem = { id: UUID_ITEM, text: "Buy materials", position: 0, done: false, done_at: null };
    setFromSequence([
      { data: { id: UUID_JOB }, error: null },  // job verify
      { count: 0, error: null },                // count
      { data: newItem, error: null },           // insert
    ]);
    const res  = await POST(makeRequest("POST", { text: "Buy materials" }), params);
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.item.text).toBe("Buy materials");
  });
});

// ---------------------------------------------------------------------------
// PATCH — toggle done
// ---------------------------------------------------------------------------
describe("PATCH /api/jobs/[id]/checklist", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetProfile.mockResolvedValue(ownerProfile); });

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { itemId: UUID_ITEM, done: true }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when itemId is invalid UUID", async () => {
    const res = await PATCH(makeRequest("PATCH", { itemId: "not-uuid", done: true }), params);
    expect(res.status).toBe(400);
  });

  it("owner can toggle any item", async () => {
    setFromSequence([{ data: {}, error: null }]);
    const res  = await PATCH(makeRequest("PATCH", { itemId: UUID_ITEM, done: true }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("worker can toggle item on assigned job", async () => {
    mockGetProfile.mockResolvedValue(workerProfile);
    setFromSequence([
      { data: { assigned_workers: [UUID_WORKER] }, error: null },  // job
      { data: {}, error: null },                                    // update
    ]);
    const res  = await PATCH(makeRequest("PATCH", { itemId: UUID_ITEM, done: true }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("worker cannot toggle item on unassigned job", async () => {
    mockGetProfile.mockResolvedValue(workerProfile);
    setFromSequence([{ data: { assigned_workers: [] }, error: null }]);
    const res  = await PATCH(makeRequest("PATCH", { itemId: UUID_ITEM, done: true }), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/not assigned/i);
  });
});

// ---------------------------------------------------------------------------
// DELETE — remove item
// ---------------------------------------------------------------------------
describe("DELETE /api/jobs/[id]/checklist", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetProfile.mockResolvedValue(ownerProfile); });

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE", { itemId: UUID_ITEM }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when role is not owner", async () => {
    mockGetProfile.mockResolvedValue(workerProfile);
    const res = await DELETE(makeRequest("DELETE", { itemId: UUID_ITEM }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when itemId is not a valid UUID", async () => {
    const res = await DELETE(makeRequest("DELETE", { itemId: "bad-id" }), params);
    expect(res.status).toBe(400);
  });

  it("deletes item and returns 200", async () => {
    setFromSequence([{ data: {}, error: null }]);
    const res  = await DELETE(makeRequest("DELETE", { itemId: UUID_ITEM }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
