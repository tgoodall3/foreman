/**
 * Tests for POST /api/estimates
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_PM     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_EST    = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetProfile = jest.fn();
jest.mock("@/lib/auth", () => ({ getProfile: mockGetProfile }));

jest.mock("@/lib/plan", () => ({ checkPlanForApi: jest.fn().mockResolvedValue(null) }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
jest.mock("@/lib/utils", () => ({ generateEstimateNumber: jest.fn(() => "ACME-EST-0001") }));

import { POST } from "../../app/api/estimates/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/estimates", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const validLineItems = [{ description: "Labor", quantity: 4, unit_price: 75 }];

const validWithPm = {
  usePm: true,
  propertyManagerId: UUID_PM,
  title: "HVAC Replacement",
  lineItems: validLineItems,
};

const validWithoutPm = {
  usePm: false,
  clientName: "John Smith",
  clientEmail: "john@example.com",
  title: "Window Repair",
  lineItems: validLineItems,
};

function buildChain(response: object) {
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    head:        jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(response),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

let callCount = 0;
function setFromSequence(responses: object[]) {
  callCount = 0;
  mockFrom.mockImplementation(() => buildChain(responses[callCount++] ?? { data: null, error: null }));
}

describe("POST /api/estimates", () => {
  beforeEach(() => { jest.clearAllMocks(); mockGetProfile.mockResolvedValue(ownerProfile); });

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await POST(makeRequest(validWithPm));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeRequest({ usePm: true, propertyManagerId: UUID_PM, lineItems: validLineItems }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when lineItems is empty", async () => {
    const res = await POST(makeRequest({ ...validWithPm, lineItems: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when PM not found (usePm=true)", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await POST(makeRequest(validWithPm));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property manager not found/i);
  });

  it("returns 400 when clientName missing (usePm=false)", async () => {
    const res = await POST(makeRequest({ usePm: false, title: "Fix", lineItems: validLineItems }));
    expect(res.status).toBe(400);
  });

  it("creates estimate with existing PM and returns 201", async () => {
    setFromSequence([
      { data: { id: UUID_PM }, error: null },       // pm lookup
      { data: { slug: "acme" }, error: null },       // tenant
      { count: 0, error: null },                     // estimate count
      { data: { id: UUID_EST }, error: null },       // insert estimate
    ]);

    const res  = await POST(makeRequest(validWithPm));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.estimateId).toBe(UUID_EST);
  });

  it("creates estimate with new client contact and returns 201", async () => {
    setFromSequence([
      { data: [], error: null },                            // email lookup (none found)
      { data: { id: UUID_PM }, error: null },              // insert new PM
      { data: { slug: "acme" }, error: null },             // tenant
      { count: 0, error: null },                           // estimate count
      { data: { id: UUID_EST }, error: null },             // insert estimate
    ]);

    const res  = await POST(makeRequest(validWithoutPm));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.estimateId).toBe(UUID_EST);
  });

  it("reuses existing client contact by email", async () => {
    setFromSequence([
      { data: [{ id: UUID_PM }], error: null },             // email lookup found existing
      { data: { slug: "acme" }, error: null },
      { count: 2, error: null },
      { data: { id: UUID_EST }, error: null },
    ]);

    const res  = await POST(makeRequest(validWithoutPm));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.estimateId).toBe(UUID_EST);
  });

  it("calculates math correctly", async () => {
    let insertPayload: any = null;
    callCount = 0;
    const responses = [
      { data: { id: UUID_PM }, error: null },
      { data: { slug: "acme" }, error: null },
      { count: 0, error: null },
      { data: { id: UUID_EST }, error: null },
    ];
    mockFrom.mockImplementation(() => {
      const r = responses[callCount++] ?? { data: null, error: null };
      const chain: any = {
        select:      jest.fn().mockReturnThis(),
        eq:          jest.fn().mockReturnThis(),
        head:        jest.fn().mockReturnThis(),
        limit:       jest.fn().mockReturnThis(),
        single:      jest.fn().mockResolvedValue(r),
        maybeSingle: jest.fn().mockResolvedValue(r),
        insert:      jest.fn().mockImplementation((p: any) => { insertPayload = p; return chain; }),
        update:      jest.fn().mockReturnThis(),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
      return chain;
    });

    // 4 × $75 = $300, 10% = $30, total = $330
    await POST(makeRequest({ ...validWithPm, taxRate: 10 }));

    expect(insertPayload.subtotal).toBe(300);
    expect(insertPayload.tax_amount).toBe(30);
    expect(insertPayload.total).toBe(330);
  });
});
