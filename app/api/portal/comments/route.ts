import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";

const listSchema = z.object({
  token: z.string().min(10),
  work_order_id: z.string().uuid(),
});

const createSchema = z.object({
  token: z.string().min(10),
  work_order_id: z.string().uuid(),
  message: z.string().min(1).max(500),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) return errorResponse("Invalid input.", 400);

  const supabase = createServiceClient();
  const { token, work_order_id } = parsed.data;

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, tenant_id")
    .eq("portal_token", token)
    .single();
  if (!pm) return errorResponse("Invalid token.", 403);

  // Verify this work order belongs to the PM (not just the tenant)
  const { data: wo } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id", work_order_id)
    .eq("property_manager_id", pm.id)
    .single();
  if (!wo) return errorResponse("Work order not found.", 404);

  const { data, error } = await supabase
    .from("work_order_comments")
    .select("id, message, created_at, property_managers(full_name)")
    .eq("tenant_id", pm.tenant_id)
    .eq("work_order_id", work_order_id)
    .order("created_at", { ascending: true });

  if (error) return errorResponse("Failed to load comments.", 500);
  return jsonResponse({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid input.", 400);

  const supabase = createServiceClient();
  const { token, work_order_id, message } = parsed.data;

  const { data: pm } = await supabase
    .from("property_managers")
    .select("id, tenant_id, full_name")
    .eq("portal_token", token)
    .single();
  if (!pm) return errorResponse("Invalid token.", 403);

  // Verify work order belongs to PM
  const { data: wo } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id", work_order_id)
    .eq("property_manager_id", pm.id)
    .single();
  if (!wo) return errorResponse("Work order not found.", 404);

  const { data: note, error } = await supabase
    .from("work_order_comments")
    .insert({
      tenant_id: pm.tenant_id,
      work_order_id,
      created_by_pm: pm.id,
      message,
    })
    .select("id, message, created_at, property_managers(full_name)")
    .single();

  if (error) return errorResponse("Failed to add comment.", 500);
  return jsonResponse({ comment: note });
}
