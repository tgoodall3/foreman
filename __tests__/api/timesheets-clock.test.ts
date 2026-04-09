/**
 * Tests for clock in/out/status routes
 */
import { NextRequest } from "next/server";

const UUID_WORKER = "123e4567-e89b-12d3-a456-426614174110";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174111";
const UUID_ENTRY  = "123e4567-e89b-12d3-a456-426614174112";

const mockRequireWorker = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireWorker: (...args: any[]) => mockRequireWorker(...args),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST as postClockIn } from "../../app/api/timesheets/clock-in/route";
import { POST as postClockOut } from "../../app/api/timesheets/clock-out/route";
import { GET as getStatus } from "../../app/api/timesheets/status/route";

function req(body?: object) {
  return new NextRequest("http://localhost", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// simple chainable supabase stub
function chain(result: any) {
  const o: any = {
    select: jest.fn(() => o),
    insert: jest.fn(() => o),
    update: jest.fn(() => o),
    eq: jest.fn(() => o),
    is: jest.fn(() => o),
    maybeSingle: jest.fn(async () => ({ data: result })),
    single: jest.fn(async () => ({ data: result })),
    order: jest.fn(() => o),
  };
  return o;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireWorker.mockResolvedValue({ id: UUID_WORKER, tenant_id: UUID_TENANT });
});

describe("clock-in", () => {
  it("inserts when no open entry", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "time_entries") return chain(null); // no open
      return chain(null);
    });
    const res = await postClockIn(req({}) as any);
    expect(res.status).toBe(200);
  });
});

describe("clock-out", () => {
  it("updates open entry", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "time_entries") return chain({ id: UUID_ENTRY });
      return chain(null);
    });
    const res = await postClockOut(req({ notes: "done" }) as any);
    expect(res.status).toBe(200);
  });
});

describe("status", () => {
  it("returns current open entry", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "time_entries") return chain({ id: UUID_ENTRY, clocked_in_at: new Date().toISOString() });
      return chain(null);
    });
    const res = await getStatus(req() as any);
    expect(res.status).toBe(200);
  });
});
