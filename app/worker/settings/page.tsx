import { requireWorker } from "@/lib/auth";
import WorkerSettingsForm from "./WorkerSettingsForm";

export default async function WorkerSettingsPage() {
  const profile = await requireWorker();

  return (
    <div className="page-shell max-w-2xl">
      <h1 className="page-title">Settings</h1>
      <WorkerSettingsForm profile={profile} />
    </div>
  );
}
