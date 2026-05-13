import { requireOwner } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { formatDate, PRIORITY_CONFIG } from "@/lib/utils";
import BillingGapClient from "./BillingGapClient";

export const dynamic = "force-dynamic";

export default async function JobsToInvoicePage() {
  const profile = await requireOwner();
  const supabase = await createServerSideClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, priority, scheduled_date, updated_at, properties(id, name, property_manager_id), work_orders(title)")
    .eq("tenant_id", profile.tenant_id)
    .eq("status", "completed")
    .is("invoice_id", null)
    .order("updated_at", { ascending: false });

  return (
    <>
      <ReportTabs active="jobs-to-invoice" />
      <BillingGapClient jobs={(jobs ?? []) as any[]} />
    </>
  );
}

function ReportTabs({ active }: { active: "revenue" | "jobs-to-invoice" | "estimate-conversion" }) {
  const tabs = [
    { key: "revenue" as const, label: "Revenue", href: "/owner/reports/revenue" },
    { key: "jobs-to-invoice" as const, label: "Billing Gap", href: "/owner/reports/jobs-to-invoice" },
    { key: "estimate-conversion" as const, label: "Conversions", href: "/owner/reports/estimate-conversion" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          className={`px-4 py-1.5 rounded-full text-sm font-600 transition-colors ${
            active === tab.key ? "bg-forge text-white" : "text-mist hover:text-forge border border-gray-200 hover:border-forge"
          }`}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}
