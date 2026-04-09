import { z } from "zod";

// Common validation schemas
export const emailSchema = z.string().email().trim().toLowerCase();
export const phoneSchema = z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional();
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
export const nameSchema = z.string().min(1).max(100).trim();
export const addressSchema = z.string().min(1).max(200).trim();
export const citySchema = z.string().min(1).max(100).trim();
export const stateSchema = z.string().length(2).toUpperCase();
export const zipSchema = z.string().regex(/^\d{5}(-\d{4})?$/);
export const notesSchema = z.string().max(1000).optional();

// UUID validation
export const uuidSchema = z.string().uuid();

// Priority enum
export const prioritySchema = z.enum(["low", "normal", "urgent", "emergency"]);

// Status enums
export const jobStatusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);
export const workOrderStatusSchema = z.enum(["pending", "accepted", "declined", "completed"]);

// Validation helpers
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') };
  }
}

// Specific schemas for API endpoints
export const inviteWorkerSchema = z.object({
  tenantId: uuidSchema,
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const toggleWorkerSchema = z.object({
  workerId: uuidSchema,
  isActive: z.boolean(),
});

export const addPropertySchema = z.object({
  tenantId: uuidSchema,
  propertyManagerId: uuidSchema,
  name: nameSchema,
  address: addressSchema,
  city: citySchema,
  state: stateSchema,
  zip: zipSchema,
  notes: notesSchema,
});

export const workOrderActionSchema = z.object({
  workOrderId: uuidSchema,
  tenantId: uuidSchema,
  action: z.enum(["accept", "decline"]),
  title: nameSchema.optional(),
  description: z.string().optional(),
  propertyId: uuidSchema.optional(),
});

export const portalSubmitSchema = z.object({
  property_manager_id: uuidSchema,
  tenant_id: uuidSchema,
  property_id: uuidSchema,
  title: nameSchema,
  description: z.string().min(1).max(1000).trim(),
  priority: prioritySchema,
});

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1).max(200).trim(),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
});

export const createInvoiceSchema = z.object({
  jobId: uuidSchema,
  propertyManagerId: uuidSchema,
  status: z.enum(["draft", "sent", "paid", "overdue"]).default("draft"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: notesSchema,
  taxRate: z.number().min(0).max(100).optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1),
});

export const updateAccountSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  address: addressSchema.optional(),
});

export const createEstimateSchema = z.object({
  propertyManagerId: uuidSchema,
  propertyId:        uuidSchema.optional(),
  title:             nameSchema,
  description:       z.string().max(2000).trim().optional(),
  lineItems:         z.array(invoiceLineItemSchema).min(1),
  taxRate:           z.number().min(0).max(100).optional(),
  validUntil:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:             notesSchema,
});