const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireOwner: mockRequireOwner,
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { GET } from "../../app/api/notifications/route";

function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue({ id: "owner-1", tenant_id: "tenant-1", role: "owner" });
  });

  it("includes work order comment notifications", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return buildChain({ data: [] });
      if (call === 2) {
        return buildChain({
          data: [
            {
              id: "comment-1",
              message: "Photo attached from site",
              created_at: "2026-04-13T12:00:00.000Z",
              property_manager: { full_name: "Tyler PM" },
              work_orders: { id: "wo-1", title: "Broken gate" },
            },
          ],
        });
      }
      if (call === 3) return buildChain({ data: [] });
      if (call === 4) return buildChain({ data: [] });
      return buildChain({ data: [] });
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "woc_comment-1",
          type: "work_order_comment",
          title: "New comment on Broken gate",
          subtitle: expect.stringContaining("Tyler PM"),
          href: "/owner/work-orders/wo-1",
        }),
      ])
    );
  });
});
