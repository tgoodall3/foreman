import { NextRequest } from "next/server";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { logError } from "@/lib/logger";

const COST_TYPES = ["material", "subcontractor", "equipment", "other"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: costs, error } = await supabase
    .from("job_costs")
    .select("id, type, description, amount, created_at")
    .eq("job_id", id)
    .eq("tenant_id", profile.tenant_id)
    .order("created_at");

  if (error) {
    logError("Job costs fetch failed", error);
    return errorResponse("Failed to fetch costs.", 500);
  }

  return jsonResponse({ costs: costs ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireOwner();
  const body = await req.json();
  const { type, description, amount } = body;

  if (!type || !COST_TYPES.includes(type)) return badRequest("Invalid cost type.");
  if (!description?.trim()) return badRequest("Description is required.");
  const amt = Number(amount);
  if (isNaN(amt) || amt < 0) return badRequest("Amount must be a non-negative number.");

  const supabase = await createServerSideClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job) return badRequest("Job not found.");

  const { data: cost, error } = await supabase
    .from("job_costs")
    .insert({
      tenant_id:   profile.tenant_id,
      job_id:      id,
      type,
      description: description.trim(),
      amount:      Math.round((amt + Number.EPSILON) * 100) / 100,
    })
    .select("id, type, description, amount, created_at")
    .single();

  if (error || !cost) {
    logError("Job cost create failed", error);
    return errorResponse("Failed to add cost.", 500);
  }

  return jsonResponse({ cost }, 201);
}
