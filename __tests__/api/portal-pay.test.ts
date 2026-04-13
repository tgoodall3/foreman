/**
 * Tests for POST /api/portal/pay
 *
 * This route was broken in production: it returned { clientSecret } but the
 * PortalDashboard PayButton did window.location.href = data.url (undefined).
 * These tests pin the contract so that regression can't ship silently.
 */
import { NextRequest } from "next/server";

const UUID_PM      = "123e4567-e89b-12d3-a456-426614174010";
const UUID_INVOICE = "123e4567-e89b-12d3-a456-426614174011";
const UUID_TENANT  = "123e4567-e89b-12d3-a456-426614174012";

// ---------------------------------------------------------------------------
// Stripe mock — return a realistic embedded-checkout session
// ---------------------------------------------------------------------------
const mockSessionCreate = jest.fn();
jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionCreate } },
  }))
);

// ---------------------------------------------------------------------------
// Supabase service client mock
// ---------------------------------------------------------------------------
const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/pay/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/portal/pay", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

/** Build a Supabase chain that resolves to `result` for any terminal call. */
function chain(result: { data: any; error?: any }) {
  const o: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then:        (res: any, rej?: any) => Promise.resolve(result).then(res, rej),
  };
  return o;
}

const pm      = { id: UUID_PM, tenant_id: UUID_TENANT, full_name: "Alice PM", email: "alice@pm.com" };
const invoice = { id: UUID_INVOICE, invoice_number: "ACME-0001", total: 500, status: "sent", jobs: { title: "Fix roof" } };
const tenant  = { stripe_connect_id: "acct_test123", stripe_connect_enabled: true };

function setupHappyPath() {
  let call = 0;
  mockFrom.mockImplementation(() => {
    call++;
    if (call === 1) return chain({ data: pm });
    if (call === 2) return chain({ data: invoice });  // invoice (Promise.all)
    if (call === 3) return chain({ data: tenant });   // tenant (Promise.all)
    return chain({ data: null });
  });

  mockSessionCreate.mockResolvedValue({
    client_secret: "cs_test_supersecret",
    url: null, // embedded mode never has a url
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/portal/pay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY      = "sk_test_xxx";
    process.env.NEXT_PUBLIC_SITE_URL   = "https://example.com";
  });

  // ─── THE CONTRACT TEST ────────────────────────────────────────────────────
  // This is the test that would have caught last night's production bug.
  // The route MUST return clientSecret (for embedded checkout) and NOT url.
  it("returns clientSecret and NOT url for embedded checkout", async () => {
    setupHappyPath();

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));
    const json = await res.json();

    expect(res.status).toBe(200);

    // This is the contract: clientSecret must be present
    expect(json.clientSecret).toBeDefined();
    expect(typeof json.clientSecret).toBe("string");

    // url must NOT be present — PortalDashboard was navigating to data.url which was undefined
    expect(json.url).toBeUndefined();
  });

  it("passes ui_mode: embedded to Stripe", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ui_mode: "embedded" })
    );
  });

  it("returns 400 when invoice_id is missing", async () => {
    const res = await POST(makeRequest({ token: "tok123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when portal token is invalid", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "bad-token" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when invoice is not found or doesn't belong to PM", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: pm });
      return chain({ data: null }); // invoice not found
    });

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when invoice is already paid", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: pm });
      if (call === 2) return chain({ data: { ...invoice, status: "paid" } });
      if (call === 3) return chain({ data: tenant });
      return chain({ data: null });
    });

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already paid/i);
  });

  it("returns 402 when tenant has not connected Stripe", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: pm });
      if (call === 2) return chain({ data: invoice });
      if (call === 3) return chain({ data: { stripe_connect_id: null, stripe_connect_enabled: false } });
      return chain({ data: null });
    });

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toMatch(/stripe/i);
  });

  it("includes ACH payment method when allowACH is true", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123", allowACH: true }));

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: expect.arrayContaining(["card", "us_bank_account"]),
      })
    );
  });

  it("excludes ACH when allowACH is false", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123", allowACH: false }));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.payment_method_types).toEqual(["card"]);
    expect(call.payment_method_types).not.toContain("us_bank_account");
  });

  it("returns 500 when Stripe throws", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: pm });
      if (call === 2) return chain({ data: invoice });
      if (call === 3) return chain({ data: tenant });
      return chain({ data: null });
    });
    mockSessionCreate.mockRejectedValue(new Error("Stripe network error"));

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE, token: "tok123" }));
    expect(res.status).toBe(500);
  });
});
