import { NextRequest } from "next/server";
import { createServerSideClient } from "@/lib/supabase-server";
import { requireWorker } from "@/lib/auth";
import { badRequest, errorResponse, jsonResponse } from "@/lib/api";
import { logError } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  // Check if job exists and user is assigned
  const { data: job } = await supabase
    .from("jobs")
    .select("id, assigned_workers")
    .eq("id", id)
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
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${profile.tenant_id}/${id}/${fileName}`;

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

  // On-the-fly thumbnail via Storage transformations (no extra file stored)
  const { data: thumbUrl } = supabase.storage
    .from("job-photos")
    .getPublicUrl(filePath, {
      transform: { width: 400, height: 400, resize: "contain", quality: 75 },
    });

  const { data: photo, error: insertError } = await supabase
    .from("job_photos")
    .insert({
      job_id: id,
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

  return jsonResponse({
    success: true,
    photoId: photo.id,
    url: publicUrl.publicUrl,
    thumbUrl: thumbUrl?.publicUrl ?? publicUrl.publicUrl,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireWorker();
  const supabase = await createServerSideClient();

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return badRequest("Missing url");

  // Only allow deletion within this tenant/job
  const { data: photo } = await supabase
    .from("job_photos")
    .select("id, url, tenant_id, job_id")
    .eq("tenant_id", profile.tenant_id)
    .eq("job_id", id)
    .eq("url", url)
    .single();

  if (!photo) return badRequest("Photo not found");

  // Derive storage path from URL
  const pathname = new URL(url).pathname; // /storage/v1/object/public/job-photos/<path>
  const idx = pathname.indexOf("/job-photos/");
  const storagePath = idx >= 0 ? pathname.substring(idx + "/job-photos/".length) : null;
  if (!storagePath) return errorResponse("Invalid storage path", 400);

  // Delete from storage (best-effort) and DB
  const { error: storageError } = await supabase.storage.from("job-photos").remove([storagePath]);
  if (storageError) logError("Photo storage delete failed", storageError);

  const { error: dbError } = await supabase.from("job_photos").delete().eq("id", photo.id);
  if (dbError) {
    logError("Photo DB delete failed", dbError);
    return errorResponse("Failed to delete photo", 500);
  }

  return jsonResponse({ success: true });
}
