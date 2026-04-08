import { createServerSideClient } from "@/lib/supabase-server";
import { Profile } from "@/types";

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = await createServerSideClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, tenant_id, email, full_name, role, plan, is_active, created_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile | null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createServerSideClient();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return null;
    }
    return getProfileByUserId(user.id);
  } catch (error) {
    // Handle auth session missing errors gracefully
    if (error instanceof Error && error.name === "AuthSessionMissingError") {
      return null;
    }
    throw error;
  }
}
