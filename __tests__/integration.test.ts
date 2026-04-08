import { rateLimit } from "../lib/rateLimit";
import { z } from "zod";

// Test schemas from API routes
const addPMSchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.string().max(100).optional(),
});

const workOrderSchema = z.object({
  property_manager_id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

describe("Integration Tests", () => {
  it("should validate rate limiting", async () => {
    // Test rate limiter function
    const result = await rateLimit("test-ip");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("reset");
  });

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
      property_manager_id: "pm-123",
      tenant_id: "tenant-123",
      property_id: "prop-123",
      title: "Fix leak",
      description: "Water leak in kitchen",
      priority: "high",
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
      property_manager_id: "",
      tenant_id: "tenant-123",
      property_id: "prop-123",
      title: "",
      description: "Description",
      priority: "invalid",
    };

    const result = workOrderSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});