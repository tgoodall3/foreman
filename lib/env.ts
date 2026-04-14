import { z } from "zod";

// Always required — app will not boot without these.
const coreSchema = z.object({
  NEXT_PUBLIC_APP_URL:          z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL:     z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY:    z.string().min(1),
});

// Required only when Stripe is in use. Validated at the call site.
const stripeSchema = z.object({
  STRIPE_SECRET_KEY:     z.string().startsWith("sk_"),
  STRIPE_PRO_PRICE_ID:   z.string().startsWith("price_"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

// Required only when email sending is in use. Validated at the call site.
const emailSchema = z.object({
  RESEND_API_KEY: z.string().startsWith("re_"),
  EMAIL_FROM:     z.string().email(),
});

export const env = coreSchema.parse(process.env);

export function getStripeEnv() {
  return stripeSchema.parse(process.env);
}

export function getEmailEnv() {
  return emailSchema.parse(process.env);
}

export function validateEnv() {
  const result = coreSchema.safeParse(process.env);
  if (!result.success) {
    return { valid: false, error: result.error.message };
  }
  return { valid: true };
}
