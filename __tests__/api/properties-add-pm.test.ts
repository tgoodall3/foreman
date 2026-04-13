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

import { POST } from "../../app/api/properties/add-pm/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/properties/add-pm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("POST /api/properties/add-pm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue({ id: "owner-1", tenant_id: UUID_TENANT, role: "owner" });
  });

  it("reuses an existing PM with the same tenant and email", async () => {
    const existingPm = {
      id: UUID_PM,
      tenant_id: UUID_TENANT,
      full_name: "Tyler PM",
      email: "tyler@example.com",
    };

    let call = 0;
    mockServiceFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) return buildChain({ data: existingPm, error: null });
      return buildChain({ data: null, error: null });
    });

    const res = await POST(
      makeRequest({
        tenantId: UUID_TENANT,
        fullName: "Tyler PM",
        email: "tyler@example.com",
        phone: "+13175551212",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reused).toBe(true);
    expect(json.pm).toEqual(existingPm);
  });
});
