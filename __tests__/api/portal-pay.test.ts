/**
 * Tests for POST /api/portal/pay
 *
 * Auth is dual-mode:
 *   1. Session-based via getPortalPm() — for logged-in PMs
 *   2. portal_token fallback — for non-PM clients who receive an invoice link
 *
 * The portal_token fallback was added after a production bug where non-PM
 * clients couldn't pay invoices sent to them.
 */
import { NextRequest } from "next/server";

const UUID_PM      = "123e4567-e89b-12d3-a456-426614174010";
const UUID_INVOICE = "123e4567-e89b-12d3-a456-426614174011";
const UUID_TENANT  = "123e4567-e89b-12d3-a456-426614174012";

// ---------------------------------------------------------------------------
// Stripe mock
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

// ---------------------------------------------------------------------------
// Portal auth mock — replaces token-based lookup
// ---------------------------------------------------------------------------
const mockGetPortalPm = jest.fn();
jest.mock("@/lib/portal", () => ({
  getPortalPm: (...args: any[]) => mockGetPortalPm(...args),
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

function chain(result: { data: any; error?: any }) {
  const o: any = {
    select:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    then:        (res: any, rej?: any) => Promise.resolve(result).then(res, rej),
  };
  return o;
}

const pm      = { id: UUID_PM, tenant_id: UUID_TENANT, full_name: "Alice PM", email: "alice@pm.com", is_active: true };
const invoice = { id: UUID_INVOICE, invoice_number: "ACME-0001", total: 500, status: "sent", jobs: { title: "Fix roof" } };
const tenant  = { stripe_connect_id: "acct_test123", stripe_connect_enabled: true };

function setupHappyPath() {
  mockGetPortalPm.mockResolvedValue(pm);

  // DB calls: 1=alias lookup, 2=invoice (Promise.all), 3=tenant (Promise.all)
  let call = 0;
  mockFrom.mockImplementation(() => {
    call++;
    if (call === 1) return chain({ data: [{ id: UUID_PM }] }); // alias lookup
    if (call === 2) return chain({ data: invoice });
    if (call === 3) return chain({ data: tenant });
    return chain({ data: null });
  });

  mockSessionCreate.mockResolvedValue({
    client_secret: "cs_test_supersecret",
    url: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/portal/pay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY    = "sk_test_xxx";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it("returns clientSecret and NOT url for embedded checkout", async () => {
    setupHappyPath();

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.clientSecret).toBeDefined();
    expect(typeof json.clientSecret).toBe("string");
    expect(json.url).toBeUndefined();
  });

  it("passes ui_mode: embedded to Stripe", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE }));

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ui_mode: "embedded" })
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetPortalPm.mockResolvedValue(null);

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when invoice_id is missing", async () => {
    mockGetPortalPm.mockResolvedValue(pm);
    mockFrom.mockReturnValue(chain({ data: [{ id: UUID_PM }] }));

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when invoice is not found or doesn't belong to PM", async () => {
    mockGetPortalPm.mockResolvedValue(pm);

    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: [{ id: UUID_PM }] });
      return chain({ data: null });
    });

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when invoice is already paid", async () => {
    mockGetPortalPm.mockResolvedValue(pm);

    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: [{ id: UUID_PM }] });
      if (call === 2) return chain({ data: { ...invoice, status: "paid" } });
      if (call === 3) return chain({ data: tenant });
      return chain({ data: null });
    });

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/already paid/i);
  });

  it("returns 402 when tenant has not connected Stripe", async () => {
    mockGetPortalPm.mockResolvedValue(pm);

    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: [{ id: UUID_PM }] });
      if (call === 2) return chain({ data: invoice });
      if (call === 3) return chain({ data: { stripe_connect_id: null, stripe_connect_enabled: false } });
      return chain({ data: null });
    });

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.error).toMatch(/stripe/i);
  });

  it("includes ACH payment method when allowACH is true", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, allowACH: true }));

    expect(mockSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: expect.arrayContaining(["card", "us_bank_account"]),
      })
    );
  });

  it("excludes ACH when allowACH is false", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, allowACH: false }));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.payment_method_types).toEqual(["card"]);
    expect(call.payment_method_types).not.toContain("us_bank_account");
  });

  it("returns 500 when Stripe throws", async () => {
    mockGetPortalPm.mockResolvedValue(pm);

    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: [{ id: UUID_PM }] });
      if (call === 2) return chain({ data: invoice });
      if (call === 3) return chain({ data: tenant });
      return chain({ data: null });
    });
    mockSessionCreate.mockRejectedValue(new Error("Stripe network error"));

    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    expect(res.status).toBe(500);
  });

  // ── portal_token fallback auth (non-PM client path) ──────────────────────

  it("authenticates via portal_token when session is absent", async () => {
    // No session PM
    mockGetPortalPm.mockResolvedValue(null);

    // The route falls back to looking up PM by portal_token in the DB
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return chain({ data: pm });           // portal_token lookup
      if (call === 2) return chain({ data: [{ id: UUID_PM }] }); // alias lookup
      if (call === 3) return chain({ data: invoice });
      if (call === 4) return chain({ data: tenant });
      return chain({ data: null });
    });
    mockSessionCreate.mockResolvedValue({ client_secret: "cs_test_tok", url: null });

    const res  = await POST(makeRequest({ invoice_id: UUID_INVOICE, portal_token: "valid-token-123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.clientSecret).toBeDefined();
  });

  it("returns 401 when both session and portal_token are absent", async () => {
    mockGetPortalPm.mockResolvedValue(null);
    // No portal_token in request body either
    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when portal_token does not match any PM", async () => {
    mockGetPortalPm.mockResolvedValue(null);
    mockFrom.mockImplementation(() => chain({ data: null })); // no PM found for token
    const res = await POST(makeRequest({ invoice_id: UUID_INVOICE, portal_token: "bad-token" }));
    expect(res.status).toBe(401);
  });

  it("includes portal_token in the Stripe return_url for seamless redirect", async () => {
    setupHappyPath();

    await POST(makeRequest({ invoice_id: UUID_INVOICE, portal_token: "my-portal-tok" }));

    const call = mockSessionCreate.mock.calls[0][0];
    expect(call.return_url).toContain("my-portal-tok");
  });
});
