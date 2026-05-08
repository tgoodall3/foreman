import { createServiceClient } from "./supabase";
import { errorResponse } from "./api";

export type PlanStatus = "active" | "trial_expired" | "no_plan";

/**
 * Returns the plan status for a tenant.
 * - "active"        — pro subscription OR trial still running
 * - "trial_expired" — on trial plan but trial_ends_at is in the past
 * - "no_plan"       — tenant record not found
 */
export interface PlanProfile {
  id: string;
  tenant_id: string;
  plan: "trial" | "pro" | "comped";
}

const ACTIVE_PLANS = ["pro", "comped"];

export async function getPlanStatus(profile: PlanProfile): Promise<PlanStatus> {
  if (ACTIVE_PLANS.includes(profile.plan)) return "active";

  const supabase = createServiceClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan, trial_ends_at")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) return "no_plan";
  if (ACTIVE_PLANS.includes(tenant.plan)) return "active";
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()) return "active";
  return "trial_expired";
}

/**
 * Call at the top of any write API route that should be gated behind an active plan.
 * Returns an error Response if the plan is not active, otherwise returns null.
 *
 * Usage:
 *   const planError = await checkPlanForApi(profile);
 *   if (planError) return planError;
 */
export async function checkPlanForApi(profile: PlanProfile): Promise<Response | null> {
  const status = await getPlanStatus(profile);
  if (status === "active") return null;
  if (status === "trial_expired") {
    return errorResponse("Your free trial has expired. Please upgrade to continue.", 402);
  }
  return errorResponse("Subscription required.", 402);
}
