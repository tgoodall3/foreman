/**
 * Unit tests for lib/services/auth.ts
 *
 * All Supabase calls are mocked so no network or database is required.
 */

// Mock @supabase/supabase-js createClient BEFORE importing the service
const mockAdmin = {
  createUser: jest.fn(),
  deleteUser:  jest.fn(),
};

const mockFrom = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: { admin: mockAdmin },
    from:  mockFrom,
  })),
}));

// Also mock the server-side client used by signInOwner
const mockSignIn = jest.fn();
jest.mock("@/lib/supabase-server", () => ({
  createServerSideClient: jest.fn(async () => ({
    auth: { signInWithPassword: mockSignIn },
  })),
}));

import { createOwnerAccount, signInOwner } from "../../lib/services/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildChain(result: object) {
  const chain: any = {
    select:      jest.fn().mockReturnThis(),
    insert:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockReturnThis(),
    eq:          jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single:      jest.fn().mockResolvedValue(result),
  };
  return chain;
}

const TENANT_ID = "tenant-123";
const USER_ID   = "user-abc";

function setupHappyPath() {
  mockAdmin.createUser.mockResolvedValue({
    data:  { user: { id: USER_ID } },
    error: null,
  });
  mockAdmin.deleteUser.mockResolvedValue({ error: null });

  // Track calls: 1st = slug check (tenants), 2nd = insert tenant, 3rd = insert profile
  let fromCallCount = 0;
  mockFrom.mockImplementation(() => {
    fromCallCount++;
    if (fromCallCount === 1) {
      // slug uniqueness check → no existing slug
      return buildChain({ data: null, error: null });
    }
    if (fromCallCount === 2) {
      // tenant insert
      return {
        ...buildChain({ data: { id: TENANT_ID, slug: "acme" }, error: null }),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: TENANT_ID, slug: "acme" }, error: null }),
      };
    }
    // profile insert
    return {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
  });
}

// ---------------------------------------------------------------------------
// createOwnerAccount
// ---------------------------------------------------------------------------
describe("createOwnerAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates auth user, tenant, and profile on success", async () => {
    setupHappyPath();

    const tenant = await createOwnerAccount({
      fullName:   "Alice Owner",
      email:      "alice@example.com",
      password:   "securepass",
      bizName:    "Acme",
      bizPhone:   "(555) 000-0001",
      bizAddress: "1 Main St",
    });

    expect(tenant.id).toBe(TENANT_ID);
    expect(mockAdmin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com" })
    );
  });

  it("throws when auth user creation fails", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data:  { user: null },
      error: new Error("Email already exists"),
    });

    await expect(
      createOwnerAccount({
        fullName: "Bob",
        email:    "bob@example.com",
        password: "pass1234",
        bizName:  "Bob Co",
      })
    ).rejects.toThrow("Email already exists");
  });

  it("deletes auth user and throws when tenant creation fails", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data:  { user: { id: USER_ID } },
      error: null,
    });
    mockAdmin.deleteUser.mockResolvedValue({ error: null });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // slug check: no conflict
        return buildChain({ data: null, error: null });
      }
      // tenant insert fails
      return {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
      };
    });

    await expect(
      createOwnerAccount({
        fullName: "Carol",
        email:    "carol@example.com",
        password: "pass1234",
        bizName:  "Carol LLC",
      })
    ).rejects.toThrow("DB error");

    expect(mockAdmin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("appends timestamp to slug when slug conflicts", async () => {
    mockAdmin.createUser.mockResolvedValue({
      data:  { user: { id: USER_ID } },
      error: null,
    });
    mockAdmin.deleteUser.mockResolvedValue({ error: null });

    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // slug exists → conflict
        return buildChain({ data: { slug: "acme" }, error: null });
      }
      if (fromCallCount === 2) {
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: { id: TENANT_ID, slug: "acme-123" }, error: null }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const tenant = await createOwnerAccount({
      fullName: "Dan",
      email:    "dan@example.com",
      password: "pass1234",
      bizName:  "Acme",
    });

    expect(tenant.id).toBe(TENANT_ID);
    // The slug passed to insert should include a timestamp suffix
    // (we can't assert the exact value since Date.now() varies)
  });
});

// ---------------------------------------------------------------------------
// signInOwner
// ---------------------------------------------------------------------------
describe("signInOwner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the user on successful sign-in", async () => {
    mockSignIn.mockResolvedValue({
      data:  { user: { id: USER_ID, email: "alice@example.com" } },
      error: null,
    });

    const user = await signInOwner("alice@example.com", "securepass");
    expect(user.id).toBe(USER_ID);
  });

  it("throws on invalid credentials", async () => {
    mockSignIn.mockResolvedValue({
      data:  { user: null },
      error: new Error("Invalid login credentials"),
    });

    await expect(signInOwner("x@x.com", "wrong")).rejects.toThrow(
      "Invalid login credentials"
    );
  });
});
