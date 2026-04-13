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

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/portal/comments/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/portal/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("POST /api/portal/comments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("emails the owner when a PM adds a comment", async () => {
    let call = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "property_managers") {
        return buildChain({ data: { id: "pm-1", tenant_id: "tenant-1", full_name: "Tyler PM" }, error: null });
      }

      if (table === "work_orders") {
        call += 1;
        if (call === 1) {
          return buildChain({ data: { id: "wo-1", title: "Broken gate", properties: { name: "Sunset Ridge" } }, error: null });
        }
        return buildChain({ data: null, error: null });
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

      return buildChain({ data: null, error: null });
    });

    const res = await POST(
      makeRequest({
        token: "tok1234567890",
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
});
