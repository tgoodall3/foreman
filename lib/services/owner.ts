import { createServerSideClient } from "@/lib/supabase-server";
import {
  Job,
  Invoice,
  OwnerInvoiceListItem,
  OwnerJobListItem,
  OwnerWorkOrderSummary,
  Profile,
  PropertyManager,
  WorkOrder,
} from "@/types";

export const OWNER_PAGE_SIZE = 20;

export async function getOwnerDashboardData(profile: Profile) {
  const supabase = await createServerSideClient();

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today      = now.toISOString().split("T")[0];

  const [
    todayJobsResult,
    upcomingResult,
    workOrdersResult,
    invoicesResult,
    workersResult,
    monthJobsResult,
    overdueInvoicesResult,
    uninvoicedResult,
    unsendResult,
  ] = await Promise.all([
    // TODAY'S jobs — full detail for the primary view
    supabase
      .from("jobs")
      .select("id, title, status, priority, scheduled_time, estimated_hours, actual_hours, assigned_workers, invoice_id, properties(name, city)")
      .eq("tenant_id", profile.tenant_id)
      .eq("scheduled_date", today)
      .not("status", "in", '("cancelled")')
      .order("scheduled_time", { ascending: true, nullsFirst: false }),

    // Next 4 days upcoming (not today, not cancelled/completed/invoiced)
    supabase
      .from("jobs")
      .select("id, title, status, priority, scheduled_date, scheduled_time, assigned_workers, properties(name)")
      .eq("tenant_id", profile.tenant_id)
      .gt("scheduled_date", today)
      .not("status", "in", '("completed","invoiced","cancelled")')
      .order("scheduled_date", { ascending: true })
      .limit(5),

    // Pending work orders
    supabase
      .from("work_orders")
      .select("id, title, priority, created_at, properties(name), property_managers(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),

    // Invoices for revenue stats
    supabase
      .from("invoices")
      .select("total, status, due_date, paid_at")
      .eq("tenant_id", profile.tenant_id),

    // Active workers (id + name for chips)
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "worker")
      .eq("is_active", true)
      .order("full_name"),

    // Jobs completed this month
    supabase
      .from("jobs")
      .select("id, actual_hours")
      .eq("tenant_id", profile.tenant_id)
      .in("status", ["completed", "invoiced"])
      .gte("updated_at", monthStart),

    // Overdue invoices
    supabase
      .from("invoices")
      .select("id, invoice_number, total, due_date, property_managers(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "sent")
      .lt("due_date", today)
      .order("due_date", { ascending: true }),

    // Completed jobs with no invoice (action needed)
    supabase
      .from("jobs")
      .select("id, title, updated_at, properties(name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "completed")
      .is("invoice_id", null)
      .order("updated_at", { ascending: false })
      .limit(10),

    // Draft invoices ready to send (action needed)
    supabase
      .from("invoices")
      .select("id, invoice_number, total, property_managers(full_name)")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const allInvoices      = (invoicesResult.data ?? []) as any[];
  const completedMonth   = monthJobsResult.data ?? [];
  const jobsWithHours    = completedMonth.filter((j: any) => j.actual_hours != null);

  return {
    today:          today,
    todayJobs:      (todayJobsResult.data  ?? []) as any[],
    upcomingJobs:   (upcomingResult.data   ?? []) as any[],
    workOrders:     (workOrdersResult.data ?? []) as any[],
    workers:        (workersResult.data    ?? []) as any[],

    metrics: {
      revenueThisMonth:   allInvoices.filter((i) => i.status === "paid" && i.paid_at >= monthStart).reduce((s: number, i: any) => s + i.total, 0),
      outstanding:        allInvoices.filter((i) => ["sent","overdue"].includes(i.status)).reduce((s: number, i: any) => s + i.total, 0),
      completedThisMonth: completedMonth.length,
      avgJobHours:        jobsWithHours.length ? jobsWithHours.reduce((s: number, j: any) => s + j.actual_hours, 0) / jobsWithHours.length : null,
      activeWorkers:      workersResult.data?.length ?? 0,
      pendingWorkOrders:  workOrdersResult.data?.length ?? 0,
    },

    // Action-needed items
    actions: {
      overdueInvoices: (overdueInvoicesResult.data ?? []) as any[],
      uninvoicedJobs:  (uninvoicedResult.data       ?? []) as any[],
      draftInvoices:   (unsendResult.data            ?? []) as any[],
      pendingOrders:   (workOrdersResult.data        ?? []) as any[],
    },
  };
}

export async function getOwnerJobs(profile: Profile, status?: string, page = 1, pageSize = OWNER_PAGE_SIZE) {
  const supabase = await createServerSideClient();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("jobs")
    .select("id, title, status, priority, scheduled_date, invoice_id, properties(name)", { count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    jobs: data as unknown as OwnerJobListItem[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getOwnerInvoices(profile: Profile, status?: string, page = 1, pageSize = OWNER_PAGE_SIZE) {
  const supabase = await createServerSideClient();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, total, due_date, job_id, property_manager_id, jobs(title), property_managers(full_name, company)", { count: "exact" })
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    invoices: data as unknown as OwnerInvoiceListItem[],
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getOwnerInvoiceTotals(profile: Profile) {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("status, total")
    .eq("tenant_id", profile.tenant_id);

  if (error) throw error;

  const totals = {
    paid: 0,
    outstanding: 0,
    draft: 0,
  };

  (data as Invoice[] | null)?.forEach((invoice) => {
    if (invoice.status === "paid") totals.paid += invoice.total;
    if (invoice.status === "sent" || invoice.status === "overdue") totals.outstanding += invoice.total;
    if (invoice.status === "draft") totals.draft += 1;
  });

  return totals;
}

export async function getOwnerWorkOrders(profile: Profile) {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, title, priority, status, created_at, properties(name), property_managers(full_name, company)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data as unknown as OwnerWorkOrderSummary[];
}

export async function getOwnerInvoiceFormData(profile: Profile) {
  const supabase = await createServerSideClient();
  const [jobsResult, managersResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "completed")
      .is("invoice_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("property_managers")
      .select("id, full_name, company")
      .eq("tenant_id", profile.tenant_id)
      .order("full_name"),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (managersResult.error) throw managersResult.error;

  return {
    jobs: jobsResult.data as { id: string; title: string }[],
    propertyManagers: managersResult.data as PropertyManager[],
  };
}

export async function getOwnerInvoiceJob(profile: Profile, jobId: string) {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, line_items")
    .eq("tenant_id", profile.tenant_id)
    .eq("id", jobId)
    .eq("status", "completed")
    .is("invoice_id", null)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data as { id: string; title: string; line_items: any[] };
}

export async function getOwnerInvoice(profile: Profile, invoiceId: string) {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, jobs(title, status), property_managers(full_name, company, email)")
    .eq("tenant_id", profile.tenant_id)
    .eq("id", invoiceId)
    .single();

  if (error) throw error;

  return data as unknown as Invoice & {
    jobs?: { title?: string; status?: string };
    property_managers?: { full_name?: string; company?: string; email?: string };
  };
}
