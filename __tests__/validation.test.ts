import { validateInput, emailSchema, createInvoiceSchema } from "../lib/validation";

describe("Validation", () => {
  test("validates email correctly", () => {
    const result = validateInput(emailSchema, "test@example.com");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("test@example.com");
    }
  });

  test("rejects invalid email", () => {
    const result = validateInput(emailSchema, "invalid-email");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid email");
    }
  });

  test("validates createInvoiceSchema correctly", () => {
    const validData = {
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      propertyManagerId: "123e4567-e89b-12d3-a456-426614174001",
      status: "draft",
      dueDate: "2024-12-31",
      notes: "Test notes",
      taxRate: 8.5,
      lineItems: [
        { description: "Work done", quantity: 1, unit_price: 100 },
      ],
    };

    const result = validateInput(createInvoiceSchema, validData);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validData);
  });

  test("rejects invalid createInvoiceSchema", () => {
    const invalidData = {
      jobId: "invalid-uuid",
      propertyManagerId: "123e4567-e89b-12d3-a456-426614174001",
      status: "invalid",
      dueDate: "invalid-date",
      lineItems: [],
    };

    const result = validateInput(createInvoiceSchema, invalidData);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
