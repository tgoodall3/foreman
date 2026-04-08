import { getProfile } from "@/lib/auth";
import PortalSettingsForm from "./PortalSettingsForm";

export default async function PortalSettingsPage() {
  const profile = await getProfile();
  if (!profile) return <div>Unauthorized</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display font-800 text-3xl text-forge mb-6">Settings</h1>
      <PortalSettingsForm profile={profile} />
    </div>
  );
}
