/**
 * Tests for POST /api/auth/signout
 */
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSignOut = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({
    auth: { signOut: mockSignOut },
  })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));

import { POST } from "../../app/api/auth/signout/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/auth/signout", { method: "POST" });
}

describe("POST /api/auth/signout", () => {
  beforeEach(() => { jest.clearAllMocks(); mockSignOut.mockResolvedValue({}); });

  it("calls supabase signOut", async () => {
    await POST(makeRequest());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("redirects to /login?signed_out=1", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toMatch(/\/login/);
    expect(location).toMatch(/signed_out=1/);
  });
});
