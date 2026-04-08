import { createServerSideClient } from "./supabase-server";
import { getCurrentProfile } from "./services/profile";
import { Profile } from "@/types";
import { redirect } from "next/navigation";

export async function getSession() {
  const supabase = await createServerSideClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(): Promise<Profile | null> {
  return getCurrentProfile();
}

export async function requireAuth(role?: Profile["role"]) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (role && profile.role !== role) redirect("/unauthorized");
  return profile;
}

export async function requireOwner() {
  return requireAuth("owner");
}

export async function requireWorker() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner" && profile.role !== "worker") redirect("/unauthorized");
  return profile;
}
