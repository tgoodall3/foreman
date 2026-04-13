const mockFrom = jest.fn();

jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

import { getOwnerInvoiceFormData } from "../../lib/services/owner";

function buildChain(result: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return chain;
}

describe("getOwnerInvoiceFormData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps property manager ids from related job properties", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "jobs") {
        return buildChain({
          data: [
            {
              id: "job-1",
              title: "Replace siding",
              properties: { property_manager_id: "pm-1" },
            },
            {
              id: "job-2",
              title: "Repair stairs",
              properties: [{ property_manager_id: "pm-2" }],
            },
          ],
          error: null,
        });
      }

      return buildChain({
        data: [{ id: "pm-1", full_name: "Alice PM", company: null, email: "alice@example.com" }],
        error: null,
      });
    });

    const result = await getOwnerInvoiceFormData({ tenant_id: "tenant-1" } as any);

    expect(result.jobs).toEqual([
      { id: "job-1", title: "Replace siding", property_manager_id: "pm-1" },
      { id: "job-2", title: "Repair stairs", property_manager_id: "pm-2" },
    ]);
    expect(result.propertyManagers).toEqual([
      { id: "pm-1", full_name: "Alice PM", company: null, email: "alice@example.com" },
    ]);
  });
});
