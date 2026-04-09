import { cache } from "react";
import { headers } from "next/headers";
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
 *
 * Fast path: middleware sets x-user-id on every owner/worker request,
 * so we skip the auth.getUser() round-trip and go straight to the DB.
 *
 * Wrapped in React.cache() so multiple callers within the same render
 * (e.g. layout + page) share a single result.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  // Fast path: trust the user ID injected by middleware
  const headersList = headers();
  const userId = headersList.get("x-user-id");
  if (userId) {
    return fetchProfileById(userId);
  }

  // Slow path: no middleware header (public/portal routes)
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
