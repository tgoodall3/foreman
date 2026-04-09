/**
 * Tests for time change request APIs
 */
import { NextRequest } from "next/server";

const UUID_WORKER = "123e4567-e89b-12d3-a456-426614174010";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174011";
const UUID_ENTRY  = "123e4567-e89b-12d3-a456-426614174012";
const UUID_REQ    = "123e4567-e89b-12d3-a456-426614174013";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireWorker = jest.fn();
const mockRequireOwner  = jest.fn();
jest.mock("@/lib/auth", () => ({
  requireWorker: (...args: any[]) => mockRequireWorker(...args),
  requireOwner:  (...args: any[]) => mockRequireOwner(...args),
}));

process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_FROM = "noreply@example.com";

const mockResendSend = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn(() => ({ emails: { send: mockResendSend } })),
}));

// simple chainable supabase stub
function chain(result: any) {
  const o: any = {
    select: jest.fn(() => o),
    insert: jest.fn(() => o),
    update: jest.fn(() => o),
    eq: jest.fn(() => o),
    is: jest.fn(() => o),
    gte: jest.fn(() => o),
    lte: jest.fn(() => o),
    order: jest.fn(() => o),
    single: jest.fn(async () => ({ data: result })),
    maybeSingle: jest.fn(async () => ({ data: result })),
  };
  return o;
}

const mockFrom = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({ from: mockFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

// Routes under test
import { POST as postChangeRequest } from "../../app/api/timesheets/change-request/route";
import { POST as postChangeRequestAction } from "../../app/api/timesheets/change-request/[id]/route";

function makeReq(url: string, body: object) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/timesheets/change-request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireWorker.mockResolvedValue({
      id: UUID_WORKER,
      tenant_id: UUID_TENANT,
      full_name: "Worker One",
    });
  });

  it("creates a change request and notifies owners", async () => {
    // Mock table responses
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "time_entries":
          return chain(null); // no open entry blocking
        case "time_change_requests":
          return chain({ id: UUID_REQ });
        case "profiles":
          return chain([{ email: "owner@example.com", full_name: "Owner User" }]);
        default:
          return chain(null);
      }
    });

    const req = makeReq("http://localhost/api/timesheets/change-request", {
      requested_date: "2026-04-09",
      requested_clocked_in_at: "2026-04-09T08:00:00Z",
      requested_clocked_out_at: "2026-04-09T16:00:00Z",
      reason: "Forgot to clock out",
    });

    const res = await postChangeRequest(req as any);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/timesheets/change-request/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue({
      id: "owner-1",
      tenant_id: UUID_TENANT,
      full_name: "Owner User",
    });
  });

  it("approves a request and updates entry", async () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case "time_change_requests":
          return chain({
            id: UUID_REQ,
            tenant_id: UUID_TENANT,
            worker_id: UUID_WORKER,
            time_entry_id: UUID_ENTRY,
            requested_clocked_in_at: "2026-04-09T08:00:00Z",
            requested_clocked_out_at: "2026-04-09T16:00:00Z",
            requested_date: "2026-04-09",
            reason: "Fix time",
          });
        case "time_entries":
          return chain({ id: UUID_ENTRY });
        case "profiles":
          return chain({ email: "worker@example.com", full_name: "Worker One" });
        default:
          return chain(null);
      }
    });

    const req = makeReq("http://localhost/api/timesheets/change-request/" + UUID_REQ, { action: "approve" });
    const res = await postChangeRequestAction(req as any, { params: { id: UUID_REQ } } as any);
    expect(res.status).toBe(200);
  });
});
