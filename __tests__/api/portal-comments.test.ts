import { NextRequest } from "next/server";

process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_FROM = "noreply@example.com";

const mockResendSend = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockResendSend } })),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({
    from: mockFrom,
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
  })),
}));

const mockGetPortalPm = jest.fn();
jest.mock("@/lib/portal", () => ({
  getPortalPm: (...args: any[]) => mockGetPortalPm(...args),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/comments/route";

const pm = { id: "pm-1", tenant_id: "tenant-1", full_name: "Tyler PM", email: "pm@example.com", is_active: true };

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/portal/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildChain(result: object) {
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    in:          jest.fn().mockReturnThis(),
    order:       jest.fn().mockReturnThis(),
    single:      jest.fn().mockResolvedValue(result),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("POST /api/portal/comments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPortalPm.mockResolvedValue(pm);
  });

  it("emails the owner when a PM adds a comment", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "work_orders") {
        return buildChain({ data: { id: "wo-1", title: "Broken gate", properties: { name: "Sunset Ridge" } }, error: null });
      }
      if (table === "work_order_comments") {
        return buildChain({
          data: {
            id: "comment-1",
            work_order_id: "wo-1",
            message: "There is more damage behind the panel.",
            created_at: "2026-04-13T12:00:00.000Z",
            property_manager: { full_name: "Tyler PM" },
          },
          error: null,
        });
      }
      if (table === "profiles") {
        return buildChain({ data: { email: "owner@example.com", full_name: "Owner" }, error: null });
      }
      if (table === "tenants") {
        return buildChain({ data: { name: "ACME Construction" }, error: null });
      }
      return buildChain({ data: null, error: null });
    });

    const res = await POST(
      makeRequest({
        work_order_id: "123e4567-e89b-12d3-a456-426614174001",
        message: "There is more damage behind the panel.",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.comment).toBeDefined();
    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        subject: "New PM comment: Broken gate",
      })
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetPortalPm.mockResolvedValue(null);

    const res = await POST(makeRequest({
      work_order_id: "123e4567-e89b-12d3-a456-426614174001",
      message: "test",
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when work_order_id is missing", async () => {
    const res = await POST(makeRequest({ message: "test" }));
    expect(res.status).toBe(400);
  });
});
