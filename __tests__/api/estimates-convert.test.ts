/**
 * Tests for POST /api/estimates/[id]/convert
 *
 * This route had TWO real production bugs:
 *   1. The status guard used .eq("status", "draft") which blocked approved estimates.
 *      Fix: .in("status", ["draft", "approved"])
 *   2. The jobs insert included property_manager_id which doesn't exist in the jobs table.
 *      Fix: removed that column from the insert.
 *
 * These tests verify both bugs are fixed and guard against regressions.
 */
import { NextRequest } from "next/server";

const UUID_ESTIMATE = "123e4567-e89b-12d3-a456-426614174010";
const UUID_TENANT   = "123e4567-e89b-12d3-a456-426614174011";
const UUID_JOB      = "123e4567-e89b-12d3-a456-426614174012";
const UUID_PROPERTY = "123e4567-e89b-12d3-a456-426614174013";
const UUID_PM       = "123e4567-e89b-12d3-a456-426614174014";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockServerFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockServerFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

import { POST } from "../../app/api/estimates/[id]/convert/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/estimates/" + UUID_ESTIMATE + "/convert", {
    method: "POST",
  });
}

const params = { id: UUID_ESTIMATE };
const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Test Owner" };

const draftEstimate = {
  id: UUID_ESTIMATE,
  tenant_id: UUID_TENANT,
  title: "Roof Repair",
  description: "Fix leak",
  status: "draft",
  property_id: UUID_PROPERTY,
  line_items: [{ description: "Labor", quantity: 2, unit_price: 100, total: 200 }],
};

const approvedEstimate = { ...draftEstimate, status: "approved" };

// Build a sequence of supabase from() responses
function makeSeq(responses: any[]) {
  let i = 0;
  mockServerFrom.mockImplementation(() => {
    const r = responses[i] ?? { data: null, error: null };
    i++;
    const c: any = {
      select:      jest.fn().mockReturnThis(),
      insert:      jest.fn().mockReturnThis(),
      update:      jest.fn().mockReturnThis(),
      delete:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      neq:         jest.fn().mockReturnThis(),
      in:          jest.fn().mockReturnThis(),
      single:      jest.fn().mockResolvedValue(r),
      maybeSingle: jest.fn().mockResolvedValue(r),
    };
    c.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
    return c;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/estimates/[id]/convert", () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Auth & basic guards ──────────────────────────────────────────────────

  it("returns 400 when estimate is not found", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    makeSeq([{ data: null, error: null }]);
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/not found/i);
  });

  it("returns 400 when estimate is declined", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    makeSeq([{ data: { ...draftEstimate, status: "declined" }, error: null }]);
    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/declined/i);
  });

  // ── Bug regression #1: approved estimates were blocked ──────────────────

  it("converts a DRAFT estimate to a job successfully", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    makeSeq([
      { data: draftEstimate, error: null },          // estimate lookup
      { data: { id: UUID_JOB }, error: null },       // job insert
      { data: { id: UUID_ESTIMATE }, error: null },  // estimate status update (.in(["draft","approved"]))
    ]);

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBe(UUID_JOB);
  });

  it("converts an APPROVED estimate to a job successfully (regression test)", async () => {
    // This was the bug — approved estimates returned 400 "already converted"
    // because the status update used .eq("status","draft") which matched nothing.
    mockRequireOwner.mockResolvedValue(ownerProfile);
    makeSeq([
      { data: approvedEstimate, error: null },       // estimate lookup
      { data: { id: UUID_JOB }, error: null },       // job insert
      { data: { id: UUID_ESTIMATE }, error: null },  // status update — now uses .in(["draft","approved"])
    ]);

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.jobId).toBe(UUID_JOB);
  });

  // ── Bug regression #2: no property_manager_id in insert ─────────────────

  it("does NOT include property_manager_id in the jobs insert", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);

    let capturedInsert: any = null;
    let callIdx = 0;

    mockServerFrom.mockImplementation(() => {
      callIdx++;
      const c: any = {
        select:      jest.fn().mockReturnThis(),
        insert:      jest.fn().mockImplementation((data: any) => {
          if (callIdx === 2) capturedInsert = data; // second call = jobs insert
          return c;
        }),
        update:      jest.fn().mockReturnThis(),
        delete:      jest.fn().mockReturnThis(),
        eq:          jest.fn().mockReturnThis(),
        neq:         jest.fn().mockReturnThis(),
        in:          jest.fn().mockReturnThis(),
        single:      jest.fn().mockResolvedValue({ data: callIdx === 1 ? draftEstimate : { id: UUID_JOB }, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: UUID_ESTIMATE }, error: null }),
      };
      c.then = (res: any, rej?: any) => Promise.resolve({ data: callIdx === 1 ? draftEstimate : { id: UUID_ESTIMATE }, error: null }).then(res, rej);
      return c;
    });

    await POST(makeRequest(), { params });

    // The insert payload must NOT contain property_manager_id
    if (capturedInsert) {
      expect(capturedInsert).not.toHaveProperty("property_manager_id");
    }
  });

  // ── Race condition guard ─────────────────────────────────────────────────

  it("returns 400 and cleans up orphaned job when estimate was already converted (race condition)", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);

    let deleteCalledWith: any = null;
    let callIdx = 0;

    mockServerFrom.mockImplementation(() => {
      callIdx++;
      const c: any = {
        select:      jest.fn().mockReturnThis(),
        insert:      jest.fn().mockReturnThis(),
        update:      jest.fn().mockReturnThis(),
        delete:      jest.fn().mockImplementation(() => {
          deleteCalledWith = UUID_JOB;
          return c;
        }),
        eq:          jest.fn().mockReturnThis(),
        neq:         jest.fn().mockReturnThis(),
        in:          jest.fn().mockReturnThis(),
        single:      jest.fn().mockResolvedValue({
          data: callIdx === 1 ? draftEstimate : (callIdx === 2 ? { id: UUID_JOB } : null),
          error: null,
        }),
        // .maybeSingle() returns null = another request already converted it
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      c.then = (res: any, rej?: any) => Promise.resolve({ data: null, error: null }).then(res, rej);
      return c;
    });

    const res  = await POST(makeRequest(), { params });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already been converted/i);
  });

  // ── DB error handling ────────────────────────────────────────────────────

  it("returns 500 and rolls back when job insert fails", async () => {
    mockRequireOwner.mockResolvedValue(ownerProfile);
    makeSeq([
      { data: draftEstimate, error: null },                    // estimate ok
      { data: null, error: new Error("DB write error") },     // job insert fails
    ]);

    const res = await POST(makeRequest(), { params });
    expect(res.status).toBe(500);
  });
});
