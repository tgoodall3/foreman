/**
 * Tests for POST /api/invoices
 */
import { NextRequest } from "next/server";

const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174001";
const UUID_PM     = "123e4567-e89b-12d3-a456-426614174002";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174003";
const UUID_INV    = "123e4567-e89b-12d3-a456-426614174004";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetProfile = jest.fn();
jest.mock("@/lib/auth", () => ({
  getProfile: mockGetProfile,
}));

// Default to active plan; individual tests can override
jest.mock("@/lib/plan", () => ({
  checkPlanForApi: jest.fn().mockResolvedValue(null),
}));

const mockSupabaseFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockSupabaseFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

import { POST } from "../../app/api/invoices/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/invoices", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

const validBody = {
  jobId:             UUID_JOB,
  propertyManagerId: UUID_PM,
  status:            "draft",
  dueDate:           "2025-12-31",
  taxRate:           10,
  lineItems:         [{ description: "Labor", quantity: 2, unit_price: 100 }],
};

// ---------------------------------------------------------------------------
// Chain builder for sequential from() calls
// ---------------------------------------------------------------------------
function makeFromSequence(responses: Array<{ data?: any; error?: any; count?: number | null }>) {
  let i = 0;
  mockSupabaseFrom.mockImplementation(() => {
    const r = responses[i] ?? { data: null, error: null };
    i++;
    const chain: any = {
      select:  jest.fn().mockReturnThis(),
      insert:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockReturnThis(),
      eq:      jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue(r),
      head:    jest.fn().mockReturnThis(),
    };
    chain.then = (res: any, rej?: any) => Promise.resolve(r).then(res, rej);
    return chain;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/invoices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when unauthenticated", async () => {
    mockGetProfile.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid payload (empty lineItems)", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    const res = await POST(makeRequest({ ...validBody, lineItems: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for bad dueDate format", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    const res = await POST(makeRequest({ ...validBody, dueDate: "31-12-2025" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when job is not found", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    makeFromSequence([{ data: null, error: null }]); // job lookup → null
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/job not found/i);
  });

  it("returns 400 when job already has an invoice", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    makeFromSequence([{ data: { id: UUID_JOB, invoice_id: UUID_INV }, error: null }]);
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invoice already exists/i);
  });

  it("returns 400 when property manager is not found", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    makeFromSequence([
      { data: { id: UUID_JOB, invoice_id: null }, error: null },  // job ok
      { data: null, error: null },                                  // pm not found
    ]);
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property manager not found/i);
  });

  it("creates an invoice and returns 201 with correct math", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);
    makeFromSequence([
      { data: { id: UUID_JOB, invoice_id: null }, error: null },         // job
      { data: { id: UUID_PM }, error: null },                             // pm
      { data: { slug: "acme" }, error: null },                            // tenant
      { count: 0, error: null },                                          // invoice count
      { data: { id: UUID_INV }, error: null },                            // insert invoice
      { data: {}, error: null },                                          // update job
    ]);

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.invoiceId).toBe(UUID_INV);
  });

  it("calculates subtotal, tax, and total correctly", async () => {
    // 2 × $100 = $200 subtotal, 10% tax = $20, total = $220
    mockGetProfile.mockResolvedValue(ownerProfile);

    let invoiceInsertData: any = null;
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      let response: any;
      if (callCount === 1) response = { data: { id: UUID_JOB, invoice_id: null }, error: null };
      else if (callCount === 2) response = { data: { id: UUID_PM }, error: null };
      else if (callCount === 3) response = { data: { slug: "testco" }, error: null };
      else if (callCount === 4) response = { count: 2, error: null };
      else if (callCount === 5) response = { data: { id: UUID_INV }, error: null };
      else response = { data: {}, error: null };

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        head:   jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(response),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockImplementation((payload: any) => {
          if (callCount === 5) invoiceInsertData = payload;
          return chain;
        }),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
      return chain;
    });

    await POST(makeRequest(validBody)); // 2 × $100, 10% tax

    expect(invoiceInsertData).toBeTruthy();
    expect(invoiceInsertData.subtotal).toBe(200);
    expect(invoiceInsertData.tax_amount).toBe(20);
    expect(invoiceInsertData.total).toBe(220);
  });

  it("generates invoice number from tenant slug and count", async () => {
    mockGetProfile.mockResolvedValue(ownerProfile);

    let invoiceInsertData: any = null;
    let callCount = 0;
    mockSupabaseFrom.mockImplementation(() => {
      callCount++;
      let response: any;
      if (callCount === 1) response = { data: { id: UUID_JOB, invoice_id: null }, error: null };
      else if (callCount === 2) response = { data: { id: UUID_PM }, error: null };
      else if (callCount === 3) response = { data: { slug: "precision" }, error: null };
      else if (callCount === 4) response = { count: 4, error: null }; // 4 existing → next is 5
      else if (callCount === 5) response = { data: { id: UUID_INV }, error: null };
      else response = { data: {}, error: null };

      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        head:   jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(response),
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockImplementation((payload: any) => {
          if (callCount === 5) invoiceInsertData = payload;
          return chain;
        }),
      };
      chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
      return chain;
    });

    await POST(makeRequest(validBody));

    expect(invoiceInsertData.invoice_number).toBe("PRECISION-0005");
  });
});
