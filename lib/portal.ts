import type { SupabaseClient } from "@supabase/supabase-js";

type PortalPmRecord = {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  company?: string | null;
  is_active?: boolean | null;
  portal_token?: string | null;
  tenants?: { name?: string | null } | { name?: string | null }[] | null;
};

export async function resolvePortalPmScope(
  supabase: SupabaseClient,
  token: string,
  select = "id, tenant_id, full_name, email, company, is_active, portal_token"
) {
  const { data: pm } = await supabase
    .from("property_managers")
    .select(select)
    .eq("portal_token", token)
    .single();

  if (!pm) {
    return { pm: null, propertyManagerIds: [] as string[] };
  }

  const basePm = pm as unknown as PortalPmRecord;
  let propertyManagerIds = [basePm.id];

  if (basePm.email) {
    const { data: aliases } = await supabase
      .from("property_managers")
      .select("id")
      .eq("tenant_id", basePm.tenant_id)
      .eq("email", basePm.email);

    const aliasRows = Array.isArray(aliases) ? aliases : aliases ? [aliases] : [];
    propertyManagerIds = Array.from(new Set(aliasRows.map((item: any) => item.id)));
  }

  return {
    pm: basePm,
    propertyManagerIds: propertyManagerIds.length ? propertyManagerIds : [basePm.id],
  };
}
