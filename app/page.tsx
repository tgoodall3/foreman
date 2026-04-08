import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "owner") redirect("/owner");
  if (profile.role === "worker") redirect("/worker");
  redirect("/login");
}
