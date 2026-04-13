import { NextRequest } from "next/server";

const UUID_PM = "123e4567-e89b-12d3-a456-426614174001";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174002";

const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireOwner: mockRequireOwner,
}));

const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/properties/delete-pm/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/properties/delete-pm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("POST /api/properties/delete-pm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue({ id: "owner-1", tenant_id: UUID_TENANT, role: "owner" });
  });

  it("returns 400 when propertyManagerId is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the PM is still active", async () => {
    let propertyManagerCalls = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "property_managers") {
        propertyManagerCalls += 1;
        if (propertyManagerCalls === 1) {
          return buildChain({ data: { id: UUID_PM, tenant_id: UUID_TENANT, is_active: true }, error: null });
        }
      }
      return buildChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ propertyManagerId: UUID_PM }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/revoke portal access/i);
  });

  it("deletes a revoked PM and returns linked record counts", async () => {
    let propertyManagerCalls = 0;
    mockServiceFrom.mockImplementation((table: string) => {
      if (table === "property_managers") {
        propertyManagerCalls += 1;
        if (propertyManagerCalls === 1) {
          return buildChain({ data: { id: UUID_PM, tenant_id: UUID_TENANT, is_active: false }, error: null });
        }
        return buildChain({ data: null, error: null });
      }

      if (table === "properties") return buildChain({ count: 2, error: null });
      if (table === "work_orders") return buildChain({ count: 3, error: null });
      if (table === "invoices") return buildChain({ count: 4, error: null });
      if (table === "estimates") return buildChain({ count: 1, error: null });

      return buildChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ propertyManagerId: UUID_PM }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.deletedCounts).toEqual({
      properties: 2,
      workOrders: 3,
      invoices: 4,
      estimates: 1,
    });
  });
});
