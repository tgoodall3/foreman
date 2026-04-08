import { createServerSideClient } from "@/lib/supabase-server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function signInOwner(email: string, password: string) {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw error ?? new Error("Unable to sign in.");
  }

  return data.user;
}

export async function createOwnerAccount(input: {
  fullName: string;
  email: string;
  password: string;
  bizName: string;
  bizPhone?: string;
  bizAddress?: string;
}) {
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { fullName, email, password, bizName, bizPhone, bizAddress } = input;

  const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw authError ?? new Error("Failed to create auth user.");
  }

  const userId = authData.user.id;

  const slugBase = bizName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let slug = slugBase || `company-${Date.now()}`;

  const { data: existing, error: existingError } = await serviceSupabase
    .from("tenants")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) slug = `${slug}-${Date.now()}`;

  const { data: tenant, error: tenantError } = await serviceSupabase
    .from("tenants")
    .insert({
      name: bizName,
      slug,
      email,
      phone: bizPhone || null,
      address: bizAddress || null,
      plan: "trial",
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (tenantError || !tenant) {
    await serviceSupabase.auth.admin.deleteUser(userId);
    throw tenantError ?? new Error("Failed to create tenant.");
  }

  const { error: profileError } = await serviceSupabase.from("profiles").insert({
    id: userId,
    tenant_id: tenant.id,
    email,
    full_name: fullName,
    role: "owner",
    is_active: true,
  });

  if (profileError) {
    await serviceSupabase.auth.admin.deleteUser(userId);
    await serviceSupabase.from("tenants").delete().eq("id", tenant.id);
    throw profileError;
  }

  return tenant;
}
