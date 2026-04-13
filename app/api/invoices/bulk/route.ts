import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, badRequest } from "@/lib/api";
import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { generateInvoiceNumber } from "@/lib/utils";
import { logError } from "@/lib/logger";

/**
 * POST /api/invoices/bulk
 * Body: { jobIds: string[] }
 * Creates a draft invoice for each completed, uninvoiced job that has a property manager.
 * Skips jobs that already have invoices or are missing a PM.
 */
export async function POST(req: NextRequest) {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] = Array.isArray(body.jobIds) ? body.jobIds : [];
  if (!jobIds.length) return badRequest("No job IDs provided.");
  if (jobIds.length > 50) return badRequest("Maximum 50 jobs per batch.");

  // Load all jobs in one query, scoped to tenant
  const { data: jobs, error: jobsErr } = await supabase
    .from("jobs")
    .select("id, title, line_items, invoice_id, property_id, tenant_id")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "completed")
    .is("invoice_id", null)
    .in("id", jobIds);

  if (jobsErr) return errorResponse("Failed to load jobs.", 500);
  if (!jobs?.length) return jsonResponse({ created: 0, skipped: jobIds.length, invoiceIds: [] });

  const [{ data: tenant }, { count: existingCount }] = await Promise.all([
    supabase.from("tenants").select("slug").eq("id", profile.tenant_id).single(),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id),
  ]);

  if (!tenant) return errorResponse("Tenant not found.", 500);

  // Load property → PM mapping for all relevant properties
  const propertyIds = Array.from(new Set(jobs.map((j) => j.property_id).filter(Boolean)));
  const { data: properties } = await supabase
    .from("properties")
    .select("id, property_manager_id")
    .in("id", propertyIds);

  const pmByProperty: Record<string, string> = {};
  for (const p of properties ?? []) {
    if (p.property_manager_id) pmByProperty[p.id] = p.property_manager_id;
  }

  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().split("T")[0];

  const invoiceIds: string[] = [];
  let skipped = 0;
  let counter = existingCount ?? 0;

  for (const job of jobs) {
    const pmId = job.property_id ? pmByProperty[job.property_id] : null;
    const lineItems: any[] = job.line_items ?? [];

    if (!pmId) { skipped++; continue; }

    const sanitized = lineItems.map((item: any) => {
      const qty   = Number(item.quantity);
      const price = Number(item.unit_price);
      const total = Math.round((qty * price + Number.EPSILON) * 100) / 100;
      return { description: item.description, quantity: qty, unit_price: price, total };
    });
    const subtotal = sanitized.reduce((s: number, i: any) => s + i.total, 0);

    counter++;
    const invoiceNumber = generateInvoiceNumber(tenant.slug, counter);

    const { data: invoice, error: insertErr } = await supabase
      .from("invoices")
      .insert({
        tenant_id:           profile.tenant_id,
        job_id:              job.id,
        property_manager_id: pmId,
        invoice_number:      invoiceNumber,
        status:              "draft",
        line_items:          sanitized,
        subtotal,
        tax_rate:            0,
        tax_amount:          0,
        total:               subtotal,
        due_date:            dueDate,
      })
      .select("id")
      .single();

    if (insertErr || !invoice) {
      logError("Bulk invoice insert failed", insertErr);
      skipped++;
      continue;
    }

    await supabase
      .from("jobs")
      .update({ invoice_id: invoice.id, status: "invoiced" })
      .eq("id", job.id)
      .eq("tenant_id", profile.tenant_id);

    invoiceIds.push(invoice.id);
  }

  return jsonResponse({ created: invoiceIds.length, skipped, invoiceIds });
}
