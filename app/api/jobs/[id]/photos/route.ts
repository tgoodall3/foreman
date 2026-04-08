import { NextRequest } from "next/server";
import { createServerSideClient } from "@/lib/supabase-server";
import { requireWorker } from "@/lib/auth";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  // Check if job exists and user is assigned
  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_workers")
    .eq("id", params.id)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!job || !job.assigned_workers?.includes(profile.id)) {
    return badRequest("Job not found or not assigned");
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File;
  const caption = formData.get("caption") as string;
  const type = formData.get("type") as string;

  if (!file || !["before", "during", "after", "general"].includes(type)) {
    return badRequest("Invalid file or type");
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `${profile.tenant_id}/${params.id}/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("job-photos")
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    logError("Photo upload failed", uploadError);
    return errorResponse("Upload failed", 500);
  }

  const { data: publicUrl } = supabase.storage
    .from("job-photos")
    .getPublicUrl(filePath);

  const { data: photo, error: insertError } = await supabase
    .from("job_photos")
    .insert({
      job_id: params.id,
      tenant_id: profile.tenant_id,
      url: publicUrl.publicUrl,
      caption: caption || null,
      uploaded_by: profile.id,
      type,
    })
    .select("id")
    .single();

  if (insertError) {
    logError("Photo insert failed", insertError);
    return errorResponse("Failed to save photo", 500);
  }

  return jsonResponse({ success: true, photoId: photo.id, url: publicUrl.publicUrl });
}
