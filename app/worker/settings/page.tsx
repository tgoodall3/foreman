import { requireWorker } from "@/lib/auth";
import WorkerSettingsForm from "./WorkerSettingsForm";

export default async function WorkerSettingsPage() {
  const profile = await requireWorker();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-display font-800 text-3xl text-forge mb-6">Settings</h1>
      <WorkerSettingsForm profile={profile} />
    </div>
  );
}
