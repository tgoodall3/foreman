import { requireWorker } from "@/lib/auth";
import { createServerSideClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import WorkerJobDetail from "@/components/worker/WorkerJobDetail";

export default async function WorkerJobPage({ params }: { params: { id: string } }) {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("*, properties(name, address, city, state)")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .contains("assigned_workers", [profile.id])
    .single();

  if (!job) notFound();

  const [{ data: photos }, { data: notes }] = await Promise.all([
    supabase.from("job_photos").select("*, profiles(full_name)").eq("job_id", job.id).order("created_at"),
    supabase.from("job_notes").select("*, profiles(full_name)").eq("job_id", job.id).order("created_at"),
  ]);

  return (
    <WorkerJobDetail
      job={job}
      photos={photos || []}
      notes={notes || []}
      profile={profile}
    />
  );
}
