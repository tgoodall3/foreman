/**
 * Tests for change-orders API routes:
 *   POST   /api/change-orders            (create)
 *   PATCH  /api/change-orders/[id]       (edit)
 *   DELETE /api/change-orders/[id]       (delete)
 *   PATCH  /api/change-orders/[id]/status
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174001";
const UUID_CO     = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", full_name: "Owner" };

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
jest.mock("@/lib/utils", () => ({ generateChangeOrderNumber: jest.fn(() => "ACME-0001") }));
jest.mock("crypto", () => ({ randomBytes: jest.fn(() => ({ toString: () => "abc123token" })) }));

import { POST as createCO } from "../../app/api/change-orders/route";
import { PATCH as editCO, DELETE as deleteCO } from "../../app/api/change-orders/[id]/route";
import { PATCH as updateStatus } from "../../app/api/change-orders/[id]/status/route";

function makeRequest(body: object, method = "POST") {
  return new NextRequest("http://localhost/api/change-orders", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: UUID_CO } };

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    head:   jest.fn().mockReturnThis(),
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

const validLineItems = [{ description: "Demo work", quantity: 2, unit_price: 150 }];

// ---------------------------------------------------------------------------
// POST /api/change-orders
// ---------------------------------------------------------------------------
describe("POST /api/change-orders", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 when jobId is missing", async () => {
    const res = await createCO(makeRequest({ title: "Fix roof", lineItems: validLineItems }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const res = await createCO(makeRequest({ jobId: UUID_JOB, lineItems: validLineItems }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lineItems is empty", async () => {
    const res = await createCO(makeRequest({ jobId: UUID_JOB, title: "Fix", lineItems: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a line item has no description", async () => {
    const res = await createCO(makeRequest({
      jobId: UUID_JOB, title: "Fix",
      lineItems: [{ description: "", quantity: 1, unit_price: 100 }],
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when job is not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res = await createCO(makeRequest({ jobId: UUID_JOB, title: "Fix roof", lineItems: validLineItems }));
    expect(res.status).toBe(400);
  });

  it("creates change order and returns 201", async () => {
    setFromSequence([
      { data: { id: UUID_JOB, property_manager_id: "pm-1" }, error: null },  // job
      { data: { slug: "acme" }, error: null },                                // tenant
      { count: 0, error: null },                                               // count
      { data: { id: UUID_CO }, error: null },                                  // insert
    ]);

    const res  = await createCO(makeRequest({ jobId: UUID_JOB, title: "Fix roof", lineItems: validLineItems }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.changeOrderId).toBe(UUID_CO);
  });

  it("calculates subtotal, tax, and total correctly", async () => {
    let insertPayload: any = null;
    callCount = 0;
    const responses = [
      { data: { id: UUID_JOB, property_manager_id: "pm-1" }, error: null },
      { data: { slug: "acme" }, error: null },
      { count: 0, error: null },
      { data: { id: UUID_CO }, error: null },
    ];
    mockFrom.mockImplementation(() => {
      const r = responses[callCount++] ?? { data: null, error: null };
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        head:   jest.fn().mockReturnThis(),
        order:  jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(r),
        insert: jest.fn().mockImplementation((payload: any) => { insertPayload = payload; return chain; }),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
      return chain;
    });

    // 2 × $150 = $300, 10% tax = $30, total = $330
    await createCO(makeRequest({ jobId: UUID_JOB, title: "Fix roof", lineItems: validLineItems, taxRate: 10 }));

    expect(insertPayload.subtotal).toBe(300);
    expect(insertPayload.tax_amount).toBe(30);
    expect(insertPayload.total).toBe(330);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/change-orders/[id] (edit)
// ---------------------------------------------------------------------------
describe("PATCH /api/change-orders/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 when title is missing", async () => {
    const res = await editCO(makeRequest({ lineItems: validLineItems }, "PATCH"), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lineItems is empty", async () => {
    const res = await editCO(makeRequest({ title: "Fix", lineItems: [] }, "PATCH"), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when change order is not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res = await editCO(makeRequest({ title: "Fix", lineItems: validLineItems }, "PATCH"), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when change order is not in draft status", async () => {
    setFromSequence([{ data: { id: UUID_CO, status: "sent" }, error: null }]);
    const res = await editCO(makeRequest({ title: "Fix", lineItems: validLineItems }, "PATCH"), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/only draft/i);
  });

  it("updates draft change order successfully", async () => {
    setFromSequence([
      { data: { id: UUID_CO, status: "draft" }, error: null },
      { data: {}, error: null },
    ]);
    const res = await editCO(makeRequest({ title: "Updated title", lineItems: validLineItems }, "PATCH"), params);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/change-orders/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/change-orders/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 when change order is not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res = await deleteCO(makeRequest({}, "DELETE"), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when change order is approved", async () => {
    setFromSequence([{ data: { id: UUID_CO, status: "approved" }, error: null }]);
    const res = await deleteCO(makeRequest({}, "DELETE"), params);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/approved.*cannot be deleted/i);
  });

  it("deletes draft change order successfully", async () => {
    setFromSequence([
      { data: { id: UUID_CO, status: "draft" }, error: null },
      { data: {}, error: null },
    ]);
    const res = await deleteCO(makeRequest({}, "DELETE"), params);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/change-orders/[id]/status
// ---------------------------------------------------------------------------
describe("PATCH /api/change-orders/[id]/status", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 for invalid status", async () => {
    const res = await updateStatus(makeRequest({ status: "bogus" }, "PATCH"), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when change order is not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res = await updateStatus(makeRequest({ status: "sent" }, "PATCH"), params);
    expect(res.status).toBe(400);
  });

  it("updates status to sent successfully", async () => {
    setFromSequence([
      { data: { id: UUID_CO, status: "draft" }, error: null },
      { data: {}, error: null },
    ]);
    const res  = await updateStatus(makeRequest({ status: "sent" }, "PATCH"), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("accepts all valid status values", async () => {
    for (const status of ["draft", "sent", "approved", "declined"]) {
      setFromSequence([
        { data: { id: UUID_CO, status: "draft" }, error: null },
        { data: {}, error: null },
      ]);
      const res = await updateStatus(makeRequest({ status }, "PATCH"), params);
      expect(res.status).toBe(200);
    }
  });
});
