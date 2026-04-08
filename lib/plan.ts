import { createServiceClient } from "./supabase";
import { errorResponse } from "./api";

export type PlanStatus = "active" | "trial_expired" | "no_plan";

/**
 * Returns the plan status for a tenant.
 * - "active"        — pro subscription OR trial still running
 * - "trial_expired" — on trial plan but trial_ends_at is in the past
 * - "no_plan"       — tenant record not found
 */
export async function getPlanStatus(tenantId: string): Promise<PlanStatus> {
  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at")
    .eq("id", tenantId)
    .single();

  if (!tenant) return "no_plan";
  if (tenant.plan === "pro") return "active";
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()) return "active";
  return "trial_expired";
}

/**
 * Call at the top of any write API route that should be gated behind an active plan.
 * Returns an error Response if the plan is not active, otherwise returns null.
 *
 * Usage:
 *   const planError = await checkPlanForApi(profile.tenant_id);
 *   if (planError) return planError;
 */
export async function checkPlanForApi(tenantId: string): Promise<Response | null> {
  const status = await getPlanStatus(tenantId);
  if (status === "active") return null;
  if (status === "trial_expired") {
    return errorResponse("Your free trial has expired. Please upgrade to continue.", 402);
  }
  return errorResponse("Subscription required.", 402);
}
