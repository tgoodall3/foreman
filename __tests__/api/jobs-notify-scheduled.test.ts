// Set env vars before any module is loaded (routes read RESEND_API_KEY at module-level)
process.env.RESEND_API_KEY       = "re_test_xxx";
process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";

/**
 * Tests for POST /api/jobs/notify-scheduled
 *
 * This new route sends a "job scheduled for {date}" email to a PM when
 * a job that originated from a work order gets a scheduled_date set.
 *
 * Key behaviours verified:
 *   - Silently no-ops if job has no work_order_id (not a WO-sourced job)
 *   - Silently no-ops if job has no scheduled_date yet
 *   - Silently no-ops if PM has no email
 *   - Sends email with correct date formatting when everything is present
 *   - Email subject includes the date
 */
import { NextRequest } from "next/server";

const UUID_JOB    = "123e4567-e89b-12d3-a456-426614174030";
const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174031";
const UUID_WO     = "123e4567-e89b-12d3-a456-426614174032";
const UUID_PM     = "123e4567-e89b-12d3-a456-426614174033";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockServiceFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

const mockResendSend = jest.fn().mockResolvedValue({ data: { id: "email_sched_1" }, error: null });
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

import { POST } from "../../app/api/jobs/notify-scheduled/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/jobs/notify-scheduled", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const basePm = {
  id: UUID_PM,
  full_name: "Alice PM",
  email: "alice@pm.com",
  portal_token: "tok-abc123",
};

const baseJob = {
  id: UUID_JOB,
  title: "Roof Repair",
  description: "Fix leak",
  scheduled_date: "2025-07-15",
  scheduled_time: null,
  tenant_id: UUID_TENANT,
  properties: { name: "123 Main St", address: "123 Main St", city: "Austin", state: "TX" },
  work_orders: { id: UUID_WO, title: "Roof Repair WO", property_managers: basePm },
};

function setupSingleJobLookup(jobData: any) {
  let call = 0;
  mockServiceFrom.mockImplementation(() => {
    call++;
    const c: any = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: jobData, error: null }),
    };
    if (call === 2) {
      // Tenant lookup
      c.single = jest.fn().mockResolvedValue({ data: { name: "Acme Co" }, error: null });
    }
    c.then = (res: any, rej?: any) => Promise.resolve({ data: {}, error: null }).then(res, rej);
    return c;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/jobs/notify-scheduled", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 ok with no job id provided (no-op)", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 200 when job has no scheduled_date yet (no-op)", async () => {
    setupSingleJobLookup({ ...baseJob, scheduled_date: null });
    const res = await POST(makeRequest({ jobId: UUID_JOB }));
    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 200 when job has no work_order_id (no-op — not a WO-sourced job)", async () => {
    setupSingleJobLookup({ ...baseJob, work_orders: null });
    const res = await POST(makeRequest({ jobId: UUID_JOB }));
    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 200 when PM has no email (no-op)", async () => {
    setupSingleJobLookup({
      ...baseJob,
      work_orders: {
        ...baseJob.work_orders,
        property_managers: { ...basePm, email: null },
      },
    });
    const res = await POST(makeRequest({ jobId: UUID_JOB }));
    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("sends a scheduled email to the PM", async () => {
    setupSingleJobLookup(baseJob);
    const res = await POST(makeRequest({ jobId: UUID_JOB }));
    expect(res.status).toBe(200);
    expect(mockResendSend).toHaveBeenCalledTimes(1);

    const emailCall = mockResendSend.mock.calls[0][0];
    expect(emailCall.to).toBe("alice@pm.com");
  });

  it("email subject includes the formatted scheduled date", async () => {
    setupSingleJobLookup(baseJob);
    await POST(makeRequest({ jobId: UUID_JOB }));

    const emailCall = mockResendSend.mock.calls[0][0];
    // Date 2025-07-15 should appear in some readable form
    expect(emailCall.subject).toMatch(/july|jul|2025/i);
  });

  it("email subject includes the job title", async () => {
    setupSingleJobLookup(baseJob);
    await POST(makeRequest({ jobId: UUID_JOB }));

    const emailCall = mockResendSend.mock.calls[0][0];
    expect(emailCall.subject).toContain("Roof Repair");
  });

  it("email body includes portal URL when PM has portal_token", async () => {
    setupSingleJobLookup(baseJob);
    await POST(makeRequest({ jobId: UUID_JOB }));

    const emailCall = mockResendSend.mock.calls[0][0];
    expect(emailCall.html).toContain("tok-abc123");
  });

  it("sends email even when PM has no portal_token (no crash)", async () => {
    setupSingleJobLookup({
      ...baseJob,
      work_orders: {
        ...baseJob.work_orders,
        property_managers: { ...basePm, portal_token: null },
      },
    });
    const res = await POST(makeRequest({ jobId: UUID_JOB }));
    expect(res.status).toBe(200);
    // Email still fires even without a portal URL
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });
});
