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

  const [jobsResult, workOrdersResult, invoicesResult, workersResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, priority, scheduled_date, created_at")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("work_orders")
      .select("id, title, priority, status, created_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("total, status")
      .eq("tenant_id", profile.tenant_id),
    supabase
      .from("profiles")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .eq("role", "worker")
      .eq("is_active", true),
  ]);

  return {
    jobs: jobsResult.data as Job[] | null,
    workOrders: workOrdersResult.data as WorkOrder[] | null,
    invoices: invoicesResult.data as Invoice[] | null,
    workers: workersResult.data as Profile[] | null,
  };
}

export async function getOwnerJobs(profile: Profile, status?: string, page = 1, pageSize = OWNER_PAGE_SIZE) {
  const supabase = await createServerSideClient();
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from("jobs")
    .select("id, title, status, priority, scheduled_date, properties(name)", { count: "exact" })
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
