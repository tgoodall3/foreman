import { createServiceClient } from "@/lib/supabase";
import PortalForm from "@/components/portal/PortalForm";
import { notFound } from "next/navigation";

export default async function PortalPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) {
    return (
      <div className="min-h-screen bg-forge flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-amber rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-800 text-forge text-2xl">F</span>
          </div>
          <h1 className="font-display font-800 text-white text-2xl mb-2">Foreman Portal</h1>
          <p className="text-mist text-sm">Please use the link provided by your contractor to access the portal.</p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();

  const { data: pm } = await supabase
    .from("property_managers")
    .select("*, tenants(name)")
    .eq("portal_token", searchParams.token)
    .single();

  if (!pm) notFound();

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("property_manager_id", pm.id)
    .order("name");

  if (!properties?.length) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-white rounded-2xl border border-gray-200 p-8">
          <p className="text-4xl mb-3">🏢</p>
          <h1 className="font-display font-800 text-xl text-forge mb-2">No Properties Yet</h1>
          <p className="text-mist text-sm">Your contractor hasn&apos;t added any properties to your account yet. Contact them to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <PortalForm
      propertyManager={pm}
      properties={properties}
      tenantName={(pm.tenants as any)?.name || "Your Contractor"}
    />
  );
}
