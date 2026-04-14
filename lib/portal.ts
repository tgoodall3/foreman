import { redirect } from "next/navigation";
import { createServerSideClient } from "./supabase-server";
import { createServiceClient } from "./supabase";

export type PortalPm = {
  id: string;
  tenant_id: string;
  full_name: string;
  email: string | null;
  company?: string | null;
  is_active: boolean;
  tenants?: { name?: string | null } | null;
};

/**
 * For server components (pages). Redirects to login if the session is missing
 * or if the session user has no linked property_manager record.
 */
export async function requirePortalPm(select = "id, tenant_id, full_name, email, company, is_active"): Promise<PortalPm> {
  const client = await createServerSideClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?next=/portal");

  const service = createServiceClient();
  const { data: pm } = await service
    .from("property_managers")
    .select(select)
    .eq("profile_id", user.id)
    .single();

  if (!pm) redirect("/login?next=/portal");
  if (pm.is_active === false) redirect("/portal/revoked");
  return pm as PortalPm;
}

/**
 * For API route handlers. Returns null (does not redirect) so the caller
 * can return the appropriate error response.
 */
export async function getPortalPm(select = "id, tenant_id, full_name, email, company, is_active"): Promise<PortalPm | null> {
  try {
    const client = await createServerSideClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const service = createServiceClient();
    const { data: pm } = await service
      .from("property_managers")
      .select(select)
      .eq("profile_id", user.id)
      .single();

    if (!pm || pm.is_active === false) return null;
    return pm as PortalPm;
  } catch {
    return null;
  }
}
