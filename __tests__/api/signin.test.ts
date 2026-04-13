/**
 * Tests for POST /api/auth/signin
 */
import { NextRequest } from "next/server";
import { createSupabaseMock } from "../helpers/supabase";

// Mock server-side Supabase (used for auth.signInWithPassword)
const mockServerSignIn = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({
    auth: { signInWithPassword: mockServerSignIn },
  })),
}));

// Mock @supabase/supabase-js (used for the service-role profile lookup)
const mockServiceFrom = jest.fn();
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ from: mockServiceFrom })),
}));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));
// Bypass the in-memory rate limiter so tests don't interfere with each other
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockReturnValue(true),
  getClientIp:    jest.fn().mockReturnValue("127.0.0.1"),
}));

import { POST } from "../../app/api/auth/signin/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/signin", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function buildProfileChain(profile: object | null, error: object | null = null) {
  const chain: any = {
    select:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    single:  jest.fn().mockResolvedValue({ data: profile, error }),
  };
  mockServiceFrom.mockReturnValue(chain);
}

describe("POST /api/auth/signin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ password: "pass1234" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({ email: "x@x.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when credentials are invalid", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: null },
      error: { message: "Invalid login credentials" },
    });

    const res  = await POST(makeRequest({ email: "x@x.com", password: "wrongpass" }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toMatch(/invalid login/i);
  });

  it("returns 403 when email is not verified", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: { id: "user-1", email: "a@b.com", email_confirmed_at: null } },
      error: null,
    });

    const res  = await POST(makeRequest({ email: "a@b.com", password: "pass1234" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/verify your email/i);
  });

  it("returns 500 when profile lookup fails", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: { id: "user-1", email: "a@b.com", email_confirmed_at: "2024-01-01T00:00:00Z" } },
      error: null,
    });
    buildProfileChain(null, { message: "row not found" });

    const res = await POST(makeRequest({ email: "a@b.com", password: "pass1234" }));
    expect(res.status).toBe(500);
  });

  it("returns 403 when account is inactive", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: { id: "user-1", email: "a@b.com", email_confirmed_at: "2024-01-01T00:00:00Z" } },
      error: null,
    });
    buildProfileChain({ role: "owner", is_active: false });

    const res  = await POST(makeRequest({ email: "a@b.com", password: "pass1234" }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/not active/i);
  });

  it("returns 200 with user and role on success", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: { id: "user-1", email: "a@b.com", email_confirmed_at: "2024-01-01T00:00:00Z" } },
      error: null,
    });
    buildProfileChain({ role: "owner", is_active: true });

    const res  = await POST(makeRequest({ email: "a@b.com", password: "pass1234" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.user.id).toBe("user-1");
    expect(json.role).toBe("owner");
  });

  it("returns 200 for an active worker role", async () => {
    mockServerSignIn.mockResolvedValue({
      data:  { user: { id: "worker-1", email: "w@b.com", email_confirmed_at: "2024-01-01T00:00:00Z" } },
      error: null,
    });
    buildProfileChain({ role: "worker", is_active: true });

    const res  = await POST(makeRequest({ email: "w@b.com", password: "pass5678" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.role).toBe("worker");
  });
});
