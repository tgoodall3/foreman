import { cache } from "react";
import { createServerSideClient } from "@/lib/supabase-server";
import { Profile } from "@/types";

const PROFILE_SELECT = "id, tenant_id, email, full_name, role, plan, is_active, created_at";

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const supabase = await createServerSideClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .single();
  return (data as Profile | null) ?? null;
}

/**
 * Returns the current user's profile.
 * Wrapped in React.cache() so multiple callers within the same render
 * (e.g. layout + page) share a single auth.getUser() call.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createServerSideClient();
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id) return null;
    return fetchProfileById(user.id);
  } catch (error) {
    if (error instanceof Error && error.name === "AuthSessionMissingError") return null;
    throw error;
  }
});

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  return fetchProfileById(userId);
}
