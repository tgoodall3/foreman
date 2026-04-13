/**
 * Tests for POST /api/auth/signup
 */
import { NextRequest } from "next/server";

const mockCreateOwnerAccount = jest.fn();
jest.mock("@/lib/services/auth", () => ({
  createOwnerAccount: mockCreateOwnerAccount,
}));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
// Bypass the in-memory rate limiter so tests don't interfere with each other
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIp:    jest.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "../../app/api/auth/signup/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const validBody = {
  fullName:   "Alice Owner",
  email:      "alice@example.com",
  password:   "securepass",
  bizName:    "Acme Contracting",
  bizPhone:   "(555) 000-0001",
  bizAddress: "100 Main St",
};

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when fullName is missing", async () => {
    const { fullName, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it("returns 400 when email is missing", async () => {
    const { email, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when bizName is missing", async () => {
    const { bizName, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    const res = await POST(makeRequest({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8 characters/i);
  });

  it("returns 200 with tenantId on success", async () => {
    mockCreateOwnerAccount.mockResolvedValue({ id: "tenant-123" });

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.tenantId).toBe("tenant-123");
    expect(mockCreateOwnerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName:   "Alice Owner",
        email:      "alice@example.com",
        bizName:    "Acme Contracting",
      })
    );
  });

  it("returns 500 when createOwnerAccount throws", async () => {
    mockCreateOwnerAccount.mockRejectedValue(new Error("DB unavailable"));

    const res  = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toMatch(/DB unavailable/i);
  });

  it("trims whitespace from string fields", async () => {
    mockCreateOwnerAccount.mockResolvedValue({ id: "tenant-456" });

    await POST(
      makeRequest({ ...validBody, fullName: "  Alice  ", bizName: "  Acme  " })
    );

    expect(mockCreateOwnerAccount).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Alice", bizName: "Acme" })
    );
  });
});
