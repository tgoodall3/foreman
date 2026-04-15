import {
  validateInput,
  emailSchema,
  phoneSchema,
  passwordSchema,
  nameSchema,
  uuidSchema,
  prioritySchema,
  inviteWorkerSchema,
  workOrderActionSchema,
  portalSubmitSchema,
  createInvoiceSchema,
  toggleWorkerSchema,
  addPropertySchema,
} from "../lib/validation";

const UUID  = "123e4567-e89b-12d3-a456-426614174000";
const UUID2 = "123e4567-e89b-12d3-a456-426614174001";

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------
describe("emailSchema", () => {
  it("accepts a valid email", () => {
    const r = validateInput(emailSchema, "user@example.com");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("user@example.com");
  });

  it("lowercases the email", () => {
    const r = validateInput(emailSchema, "User@Example.COM");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("user@example.com");
  });

  it("rejects an email with no @", () => {
    expect(validateInput(emailSchema, "notanemail").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateInput(emailSchema, "").success).toBe(false);
  });

  it("rejects null", () => {
    expect(validateInput(emailSchema, null).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// phoneSchema
// ---------------------------------------------------------------------------
describe("phoneSchema", () => {
  it("accepts a standard US phone", () => {
    expect(validateInput(phoneSchema, "(555) 000-1234").success).toBe(true);
  });

  it("accepts a phone with country code", () => {
    expect(validateInput(phoneSchema, "+1 800 555 0100").success).toBe(true);
  });

  it("accepts undefined (optional field)", () => {
    expect(validateInput(phoneSchema, undefined).success).toBe(true);
  });

  it("rejects letters in phone", () => {
    expect(validateInput(phoneSchema, "abc-def-ghij").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------
describe("passwordSchema", () => {
  it("accepts a password >= 8 chars", () => {
    expect(validateInput(passwordSchema, "securepassword").success).toBe(true);
  });

  it("accepts exactly 8 chars", () => {
    expect(validateInput(passwordSchema, "12345678").success).toBe(true);
  });

  it("rejects a 7-char password", () => {
    const r = validateInput(passwordSchema, "1234567");
    expect(r.success).toBe(false);
    if ("error" in r) expect(r.error).toContain("8 characters");
  });

  it("rejects empty string", () => {
    expect(validateInput(passwordSchema, "").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nameSchema
// ---------------------------------------------------------------------------
describe("nameSchema", () => {
  it("accepts a normal name", () => {
    expect(validateInput(nameSchema, "Acme Contracting").success).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateInput(nameSchema, "").success).toBe(false);
  });

  it("rejects a 101-char string", () => {
    expect(validateInput(nameSchema, "a".repeat(101)).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uuidSchema
// ---------------------------------------------------------------------------
describe("uuidSchema", () => {
  it("accepts a valid UUID v4", () => {
    expect(validateInput(uuidSchema, UUID).success).toBe(true);
  });

  it("rejects a plain string", () => {
    expect(validateInput(uuidSchema, "not-a-uuid").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateInput(uuidSchema, "").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// prioritySchema
// ---------------------------------------------------------------------------
describe("prioritySchema", () => {
  it.each(["low", "normal", "high", "urgent"])("accepts '%s'", (p) => {
    expect(validateInput(prioritySchema, p).success).toBe(true);
  });

  it("rejects unknown priority 'critical'", () => {
    expect(validateInput(prioritySchema, "critical").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inviteWorkerSchema
// ---------------------------------------------------------------------------
describe("inviteWorkerSchema", () => {
  const valid = {
    tenantId:  UUID,
    fullName:  "Jane Worker",
    email:     "jane@example.com",
    password:  "password123",
  };

  it("accepts a complete invite payload", () => {
    expect(validateInput(inviteWorkerSchema, valid).success).toBe(true);
  });

  it("accepts payload with optional phone", () => {
    expect(
      validateInput(inviteWorkerSchema, { ...valid, phone: "(555) 123-4567" }).success
    ).toBe(true);
  });

  it("rejects missing tenantId", () => {
    const { tenantId, ...rest } = valid;
    expect(validateInput(inviteWorkerSchema, rest).success).toBe(false);
  });

  it("rejects invalid email", () => {
    expect(
      validateInput(inviteWorkerSchema, { ...valid, email: "bad" }).success
    ).toBe(false);
  });

  it("rejects short password", () => {
    expect(
      validateInput(inviteWorkerSchema, { ...valid, password: "short" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// workOrderActionSchema
// ---------------------------------------------------------------------------
describe("workOrderActionSchema", () => {
  const valid = {
    workOrderId: UUID,
    tenantId:    UUID2,
    action:      "accept" as const,
  };

  it("accepts 'accept' action", () => {
    expect(validateInput(workOrderActionSchema, valid).success).toBe(true);
  });

  it("accepts 'decline' action", () => {
    expect(
      validateInput(workOrderActionSchema, { ...valid, action: "decline" }).success
    ).toBe(true);
  });

  it("accepts optional title, description, propertyId", () => {
    expect(
      validateInput(workOrderActionSchema, {
        ...valid,
        title:       "Fix roof",
        description: "Leak found",
        propertyId:  UUID,
      }).success
    ).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(
      validateInput(workOrderActionSchema, { ...valid, action: "approve" }).success
    ).toBe(false);
  });

  it("rejects a non-UUID workOrderId", () => {
    expect(
      validateInput(workOrderActionSchema, { ...valid, workOrderId: "bad" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// portalSubmitSchema
// ---------------------------------------------------------------------------
describe("portalSubmitSchema", () => {
  const valid = {
    property_id:  UUID,
    title:        "Broken window",
    description:  "The window in unit 3 is cracked.",
    priority:     "normal" as const,
  };

  it("accepts a valid portal submission", () => {
    expect(validateInput(portalSubmitSchema, valid).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(
      validateInput(portalSubmitSchema, { ...valid, title: "" }).success
    ).toBe(false);
  });

  it("rejects empty description", () => {
    expect(
      validateInput(portalSubmitSchema, { ...valid, description: "" }).success
    ).toBe(false);
  });

  it("rejects invalid priority", () => {
    expect(
      validateInput(portalSubmitSchema, { ...valid, priority: "medium" as any }).success
    ).toBe(false);
  });

  it("rejects non-UUID property_id", () => {
    expect(
      validateInput(portalSubmitSchema, { ...valid, property_id: "not-a-uuid" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createInvoiceSchema
// ---------------------------------------------------------------------------
describe("createInvoiceSchema", () => {
  const validLineItem = { description: "Labor", quantity: 2, unit_price: 75 };
  const valid = {
    jobId:             UUID,
    propertyManagerId: UUID2,
    status:            "draft" as const,
    dueDate:           "2025-12-31",
    taxRate:           8.5,
    lineItems:         [validLineItem],
  };

  it("accepts a valid invoice payload", () => {
    expect(validateInput(createInvoiceSchema, valid).success).toBe(true);
  });

  it("defaults status to 'draft' when omitted", () => {
    const { status, ...rest } = valid;
    const r = validateInput(createInvoiceSchema, rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("draft");
  });

  it("accepts optional notes", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, notes: "Pay by EFT" }).success
    ).toBe(true);
  });

  it("rejects empty lineItems array", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, lineItems: [] }).success
    ).toBe(false);
  });

  it("rejects bad dueDate format", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, dueDate: "December 31, 2025" }).success
    ).toBe(false);
  });

  it("rejects negative unit_price", () => {
    expect(
      validateInput(createInvoiceSchema, {
        ...valid,
        lineItems: [{ ...validLineItem, unit_price: -1 }],
      }).success
    ).toBe(false);
  });

  it("rejects zero quantity", () => {
    expect(
      validateInput(createInvoiceSchema, {
        ...valid,
        lineItems: [{ ...validLineItem, quantity: 0 }],
      }).success
    ).toBe(false);
  });

  it("rejects taxRate > 100", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, taxRate: 101 }).success
    ).toBe(false);
  });

  it("rejects taxRate < 0", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, taxRate: -1 }).success
    ).toBe(false);
  });

  it("rejects invalid status value", () => {
    expect(
      validateInput(createInvoiceSchema, { ...valid, status: "cancelled" as any }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toggleWorkerSchema
// ---------------------------------------------------------------------------
describe("toggleWorkerSchema", () => {
  it("accepts valid toggle payload", () => {
    expect(
      validateInput(toggleWorkerSchema, { workerId: UUID, isActive: false }).success
    ).toBe(true);
  });

  it("rejects non-boolean isActive", () => {
    expect(
      validateInput(toggleWorkerSchema, { workerId: UUID, isActive: "true" }).success
    ).toBe(false);
  });

  it("rejects missing workerId", () => {
    expect(
      validateInput(toggleWorkerSchema, { isActive: true }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addPropertySchema
// ---------------------------------------------------------------------------
describe("addPropertySchema", () => {
  const valid = {
    tenantId:          UUID,
    propertyManagerId: UUID2,
    name:              "Sunrise Apartments",
    address:           "100 Main St",
    city:              "Indianapolis",
    state:             "IN",
    zip:               "46201",
  };

  it("accepts a complete property payload", () => {
    expect(validateInput(addPropertySchema, valid).success).toBe(true);
  });

  it("rejects a non-2-letter state code", () => {
    expect(
      validateInput(addPropertySchema, { ...valid, state: "Indiana" }).success
    ).toBe(false);
  });

  it("rejects bad zip format", () => {
    expect(
      validateInput(addPropertySchema, { ...valid, zip: "462" }).success
    ).toBe(false);
  });

  it("accepts ZIP+4 format", () => {
    expect(
      validateInput(addPropertySchema, { ...valid, zip: "46201-1234" }).success
    ).toBe(true);
  });

  it("accepts optional notes", () => {
    expect(
      validateInput(addPropertySchema, { ...valid, notes: "Gate code: 1234" }).success
    ).toBe(true);
  });
});
