import { createServerSideClient } from "@/lib/supabase-server";
import { Profile } from "@/types";

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, tenant_id, email, full_name, role, is_active, created_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createServerSideClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }
  if (!user?.id) {
    return null;
  }
  return getProfileByUserId(user.id);
}
