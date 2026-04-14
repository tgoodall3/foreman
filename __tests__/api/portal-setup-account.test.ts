import { NextRequest } from "next/server";

const mockFrom = jest.fn();
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({
    from: mockFrom,
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/setup-account/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/portal/setup-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chain(result: { data: any; error?: any }) {
  const o: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  o.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return o;
}

describe("POST /api/portal/setup-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a PM account and links it to the property manager record", async () => {
    let call = 0;
    mockFrom.mockImplementation((table: string) => {
      call += 1;
      if (table === "property_managers" && call === 1) {
        return chain({
          data: {
            id: "pm-1",
            tenant_id: "tenant-1",
            full_name: "Tyler PM",
            email: "pm@example.com",
            phone: null,
            profile_id: null,
            setup_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
            is_active: true,
          },
          error: null,
        });
      }
      return chain({ data: {}, error: null });
    });
    mockCreateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const res = await POST(makeRequest({ token: "abcd1234abcd", password: "password123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockCreateUser).toHaveBeenCalled();
  });

  it("rejects expired setup links", async () => {
    mockFrom.mockImplementation(() =>
      chain({
        data: {
          id: "pm-1",
          tenant_id: "tenant-1",
          full_name: "Tyler PM",
          email: "pm@example.com",
          phone: null,
          profile_id: null,
          setup_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
          is_active: true,
        },
        error: null,
      })
    );

    const res = await POST(makeRequest({ token: "abcd1234abcd", password: "password123" }));
    expect(res.status).toBe(410);
  });
});
