/**
 * Tests for POST /api/settings/password
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner", email: "owner@example.com" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockSignIn      = jest.fn();
const mockUpdateUser  = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({
    auth: { signInWithPassword: mockSignIn },
  })),
}));
jest.mock("@/lib/supabase", () => ({
  createServiceClient: jest.fn(() => ({
    auth: { admin: { updateUserById: mockUpdateUser } },
  })),
}));

jest.mock("next/headers", () => ({ cookies: jest.fn(() => ({ get: jest.fn() })) }));
jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

import { POST } from "../../app/api/settings/password/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/settings/password", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const validBody = { currentPassword: "OldPass123!", newPassword: "NewPass456!" };

describe("POST /api/settings/password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOwner.mockResolvedValue(ownerProfile);
    mockSignIn.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when currentPassword is missing", async () => {
    const res = await POST(makeRequest({ newPassword: "NewPass456!" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is too short", async () => {
    const res = await POST(makeRequest({ currentPassword: "OldPass123!", newPassword: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when current password is wrong", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/current password is incorrect/i);
  });

  it("returns 500 when password update fails", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: { message: "Update failed" } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("changes password successfully", async () => {
    const res  = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith(ownerProfile.id, { password: validBody.newPassword });
  });
});
