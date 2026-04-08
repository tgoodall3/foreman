import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getOwnerInvoiceFormData, getOwnerInvoiceJob } from "@/lib/services/owner";
import NewInvoiceForm from "./NewInvoiceForm";

export default async function NewInvoicePage({ searchParams }: { searchParams: { job?: string } }) {
  const profile = await requireOwner();
  const { jobs, propertyManagers } = await getOwnerInvoiceFormData(profile);
  const selectedJob = searchParams.job ? await getOwnerInvoiceJob(profile, searchParams.job) : null;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/owner/invoices" className="text-mist hover:text-forge text-sm transition-colors">Invoices</Link>
        <span className="text-mist">/</span>
        <span className="text-sm text-forge">New Invoice</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-3xl text-forge">New Invoice</h1>
          <p className="text-sm text-mist mt-1">Create a new invoice for a completed job and assign it to a property manager.</p>
        </div>
      </div>

      <NewInvoiceForm jobs={jobs} propertyManagers={propertyManagers} selectedJob={selectedJob} />
    </div>
  );
}
