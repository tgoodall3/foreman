import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceFormData, getOwnerInvoiceJob } from "@/lib/services/owner";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { job: jobParam } = await searchParams;
  const profile = await requireOwner();
  const { jobs, propertyManagers } = await getOwnerInvoiceFormData(profile);
  const selectedJob = jobParam ? await getOwnerInvoiceJob(profile, jobParam) : null;

  return (
    <div className="page-shell page-shell-tight">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/owner/invoices" className="text-mist hover:text-forge text-sm transition-colors">Invoices</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">New Invoice</span>
      </div>

      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">New Invoice</h1>
          <p className="page-subtitle">Create a new invoice for a completed job and assign it to a property manager.</p>
        </div>
      </div>

      <NewInvoiceForm jobs={jobs} propertyManagers={propertyManagers} selectedJob={selectedJob} />
    </div>
  );
}
