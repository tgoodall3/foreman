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

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  const ALLOWED_PHOTO_TYPES = ["before", "during", "after", "general"];

  if (!file || !ALLOWED_PHOTO_TYPES.includes(type)) {
    return badRequest("Invalid file or type");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return badRequest("Only JPEG, PNG, and WebP images are accepted.");
  }
  if (file.size > 20 * 1024 * 1024) {
    return badRequest("File size must be under 20 MB.");
  }

  // Derive extension from MIME type — don't trust user-supplied file name
  const EXT_MAP: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const fileExt = EXT_MAP[file.type] ?? "jpg";
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
