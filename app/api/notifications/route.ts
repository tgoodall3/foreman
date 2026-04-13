import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";

export async function GET() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();
  const tenantId = profile.tenant_id;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: workOrders },
    { data: workOrderComments },
    { data: timeRequests },
    { data: estimates },
    { data: invoices },
  ] = await Promise.all([
    supabase
      .from("work_orders")
      .select("id, title, status, created_at, properties(name)")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("work_order_comments")
      .select("id, message, created_at, property_manager:property_managers!work_order_comments_created_by_pm_fkey(full_name), work_orders(id, title)")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("time_change_requests")
      .select("id, status, created_at, worker:profiles(full_name), job:jobs(title)")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("estimates")
      .select("id, estimate_number, title, status, updated_at, property_manager:property_managers(full_name)")
      .eq("tenant_id", tenantId)
      .in("status", ["approved", "declined"])
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(15),

    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, updated_at, property_managers(full_name)")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  type Notification = {
    id: string;
    type: "work_order" | "work_order_comment" | "time_request" | "estimate" | "invoice";
    title: string;
    subtitle: string;
    href: string;
    createdAt: string;
    read: boolean;
  };

  const notifications: Notification[] = [];

  for (const wo of workOrders ?? []) {
    const prop = (wo.properties as any)?.name;
    notifications.push({
      id: `wo_${wo.id}`,
      type: "work_order",
      title: wo.title || "New work order",
      subtitle: prop ? `Property: ${prop}` : "Pending review",
      href: `/owner/work-orders/${wo.id}`,
      createdAt: wo.created_at,
      read: false,
    });
  }

  for (const comment of workOrderComments ?? []) {
    const pmName = (comment.property_manager as any)?.full_name ?? "Property manager";
    const workOrder = Array.isArray((comment as any).work_orders) ? (comment as any).work_orders[0] : (comment as any).work_orders;
    const preview = comment.message?.length > 48 ? `${comment.message.slice(0, 48)}...` : comment.message;
    notifications.push({
      id: `woc_${comment.id}`,
      type: "work_order_comment",
      title: `New comment on ${workOrder?.title || "work order"}`,
      subtitle: `${pmName}: ${preview || "Comment added"}`,
      href: workOrder?.id ? `/owner/work-orders/${workOrder.id}` : "/owner/work-orders",
      createdAt: comment.created_at,
      read: false,
    });
  }

  for (const tr of timeRequests ?? []) {
    const workerName = (tr.worker as any)?.full_name ?? "A worker";
    const jobTitle = (tr.job as any)?.title ?? "a job";
    notifications.push({
      id: `tr_${tr.id}`,
      type: "time_request",
      title: "Time change request",
      subtitle: `${workerName} on ${jobTitle}`,
      href: `/owner/timesheets`,
      createdAt: tr.created_at,
      read: false,
    });
  }

  for (const est of estimates ?? []) {
    const pmName = (est.property_manager as any)?.full_name ?? "Client";
    const statusLabel = est.status === "approved" ? "Approved" : "Declined";
    notifications.push({
      id: `est_${est.id}`,
      type: "estimate",
      title: `Estimate ${statusLabel.toLowerCase()}`,
      subtitle: `${est.title || est.estimate_number} · ${pmName}`,
      href: `/owner/estimates/${est.id}`,
      createdAt: est.updated_at,
      read: false,
    });
  }

  for (const inv of invoices ?? []) {
    const pmName = (inv.property_managers as any)?.full_name ?? "Client";
    notifications.push({
      id: `inv_${inv.id}`,
      type: "invoice",
      title: "Invoice paid",
      subtitle: `${inv.invoice_number} · ${pmName}`,
      href: `/owner/invoices/${inv.id}`,
      createdAt: inv.updated_at,
      read: false,
    });
  }

  // Sort newest first
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ notifications: notifications.slice(0, 30) });
}
