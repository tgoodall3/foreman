import { requireWorker } from "@/lib/auth";
import { getServerT } from "@/lib/i18n/server";
import WorkerSettingsForm from "./WorkerSettingsForm";

export default async function WorkerSettingsPage() {
  const [profile, t] = await Promise.all([requireWorker(), getServerT()]);

  return (
    <div className="page-shell max-w-2xl">
      <h1 className="page-title">{t("settings.settingsTitle")}</h1>
      <WorkerSettingsForm profile={profile} />
    </div>
  );
}
