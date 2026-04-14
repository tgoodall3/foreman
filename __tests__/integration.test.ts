import { z } from "zod";

const addPMSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.string().max(100).optional(),
});

const workOrderSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "normal", "urgent", "emergency"]),
});

describe("Integration Tests", () => {
  it("should validate property manager schema", () => {
    const validData = {
      email: "test@example.com",
      first_name: "John",
      last_name: "Doe",
      company: "Test Company",
    };

    const result = addPMSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should validate work order schema", () => {
    const validData = {
      property_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Fix leak",
      description: "Water leak in kitchen",
      priority: "urgent",
    };

    const result = workOrderSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid property manager data", () => {
    const invalidData = {
      email: "invalid-email",
      first_name: "",
      last_name: "Doe",
    };

    const result = addPMSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject invalid work order data", () => {
    const invalidData = {
      property_id: "not-a-uuid",
      title: "",
      description: "Description",
      priority: "invalid",
    };

    const result = workOrderSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
