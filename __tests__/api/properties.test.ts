/**
 * Tests for property management routes:
 *   POST /api/properties/add-property
 *   POST /api/properties/toggle-pm-access
 */
import { NextRequest } from "next/server";

const UUID_TENANT = "123e4567-e89b-12d3-a456-426614174000";
const UUID_PM     = "123e4567-e89b-12d3-a456-426614174001";
const UUID_PROP   = "123e4567-e89b-12d3-a456-426614174002";

const ownerProfile = { id: "owner-1", tenant_id: UUID_TENANT, role: "owner" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRequireOwner = jest.fn();
jest.mock("@/lib/auth", () => ({ requireOwner: mockRequireOwner }));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({ createServiceClient: jest.fn(() => ({ from: mockFrom })) }));

jest.mock("@/lib/logger", () => ({ logError: jest.fn() }));

jest.mock("@/lib/validation", () => {
  const actual = jest.requireActual("@/lib/validation");
  return { ...actual };
});

import { POST as addProperty }    from "../../app/api/properties/add-property/route";
import { POST as togglePmAccess } from "../../app/api/properties/toggle-pm-access/route";

function makeRequest(url: string, body: object) {
  return new NextRequest(`http://localhost${url}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

function buildChain(response: object) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(response),
  };
  chain.then = (res: any, rej?: any) => Promise.resolve(response).then(res, rej);
  return chain;
}

let callCount = 0;
function setFromSequence(responses: object[]) {
  callCount = 0;
  mockFrom.mockImplementation(() => buildChain(responses[callCount++] ?? { data: null, error: null }));
}

const validPropertyBody = {
  tenantId: UUID_TENANT,
  name:     "123 Main Street",
  address:  "123 Main St",
  city:     "Springfield",
  state:    "IL",
  zip:      "62701",
};

// ===========================================================================
// add-property
// ===========================================================================
describe("POST /api/properties/add-property", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 401 when unauthenticated", async () => {
    mockRequireOwner.mockResolvedValue(null);
    const res = await addProperty(makeRequest("/api/properties/add-property", validPropertyBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const { name, ...rest } = validPropertyBody;
    const res = await addProperty(makeRequest("/api/properties/add-property", rest));
    expect(res.status).toBe(400);
  });

  it("returns 403 when tenantId does not match owner", async () => {
    const res = await addProperty(makeRequest("/api/properties/add-property", {
      ...validPropertyBody,
      tenantId: "99999999-9999-4999-8999-999999999999",
    }));
    expect(res.status).toBe(403);
  });

  it("returns 404 when PM is not found (propertyManagerId supplied)", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await addProperty(makeRequest("/api/properties/add-property", {
      ...validPropertyBody, propertyManagerId: UUID_PM,
    }));
    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toMatch(/property manager not found/i);
  });

  it("creates property without PM and returns it", async () => {
    const property = { id: UUID_PROP, ...validPropertyBody, property_manager_id: null };
    setFromSequence([{ data: property, error: null }]);
    const res  = await addProperty(makeRequest("/api/properties/add-property", validPropertyBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.property.id).toBe(UUID_PROP);
  });

  it("creates property with PM and returns it", async () => {
    const property = { id: UUID_PROP, ...validPropertyBody, property_manager_id: UUID_PM };
    setFromSequence([
      { data: { id: UUID_PM }, error: null },   // PM verify
      { data: property, error: null },           // insert
    ]);
    const res  = await addProperty(makeRequest("/api/properties/add-property", {
      ...validPropertyBody, propertyManagerId: UUID_PM,
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.property.property_manager_id).toBe(UUID_PM);
  });
});

// ===========================================================================
// toggle-pm-access
// ===========================================================================
describe("POST /api/properties/toggle-pm-access", () => {
  beforeEach(() => { jest.clearAllMocks(); mockRequireOwner.mockResolvedValue(ownerProfile); });

  it("returns 400 when propertyManagerId is missing", async () => {
    const res  = await togglePmAccess(makeRequest("/api/properties/toggle-pm-access", {}));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toMatch(/propertyManagerId is required/i);
  });

  it("returns 404 when PM not found", async () => {
    setFromSequence([{ data: null, error: null }]);
    const res  = await togglePmAccess(makeRequest("/api/properties/toggle-pm-access", { propertyManagerId: UUID_PM }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when PM belongs to different tenant", async () => {
    setFromSequence([{ data: { id: UUID_PM, tenant_id: "other-tenant", is_active: true }, error: null }]);
    const res  = await togglePmAccess(makeRequest("/api/properties/toggle-pm-access", { propertyManagerId: UUID_PM }));
    expect(res.status).toBe(404);
  });

  it("toggles PM from active to inactive", async () => {
    setFromSequence([
      { data: { id: UUID_PM, tenant_id: UUID_TENANT, is_active: true }, error: null },
      { data: { id: UUID_PM, is_active: false }, error: null },
    ]);
    const res  = await togglePmAccess(makeRequest("/api/properties/toggle-pm-access", { propertyManagerId: UUID_PM }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.is_active).toBe(false);
  });

  it("toggles PM from inactive to active", async () => {
    setFromSequence([
      { data: { id: UUID_PM, tenant_id: UUID_TENANT, is_active: false }, error: null },
      { data: { id: UUID_PM, is_active: true }, error: null },
    ]);
    const res  = await togglePmAccess(makeRequest("/api/properties/toggle-pm-access", { propertyManagerId: UUID_PM }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.is_active).toBe(true);
  });
});
