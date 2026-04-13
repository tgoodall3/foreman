import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { errorResponse, jsonResponse } from "@/lib/api";
import { renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";
import { resolvePortalPmScope } from "@/lib/portal";
import { Resend } from "resend";

const listSchema = z.object({
  token: z.string().min(10),
  work_order_id: z.string().uuid(),
});

const createSchema = z.object({
  token: z.string().min(10),
  work_order_id: z.string().uuid(),
  message: z.string().min(1).max(500),
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

type WorkOrderPhoto = {
  url: string;
  caption: string | null;
  created_at: string;
  uploaded_by_pm_id: string;
  source: "submission" | "comment";
  comment_id?: string;
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = listSchema.safeParse(params);
  if (!parsed.success) return errorResponse("Invalid input.", 400);

  const supabase = createServiceClient();
  const { token, work_order_id } = parsed.data;

  const { pm, propertyManagerIds } = await resolvePortalPmScope(
    supabase as any,
    token,
    "id, tenant_id, email"
  );
  if (!pm) return errorResponse("Invalid token.", 403);

  const { data: wo } = await supabase
    .from("work_orders")
    .select("id, title, properties(name)")
    .eq("id", work_order_id)
    .in("property_manager_id", propertyManagerIds)
    .single();
  if (!wo) return errorResponse("Work order not found.", 404);

  const { data, error } = await supabase
    .from("work_order_comments")
    .select("id, work_order_id, message, created_at, property_manager:property_managers!work_order_comments_created_by_pm_fkey(full_name)")
    .eq("tenant_id", pm.tenant_id)
    .eq("work_order_id", work_order_id)
    .order("created_at", { ascending: true });

  if (error) return errorResponse("Failed to load comments.", 500);
  return jsonResponse({ comments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const isMultipart = req.headers.get("content-type")?.includes("multipart/form-data");
  const body = isMultipart ? await req.formData() : await req.json().catch(() => ({}));
  const payload = isMultipart
    ? {
        token: asString(body.get("token")),
        work_order_id: asString(body.get("work_order_id")),
        message: asString(body.get("message")),
      }
    : body;
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return errorResponse("Invalid input.", 400);

  const supabase = createServiceClient();
  const { token, work_order_id, message } = parsed.data;

  const { pm, propertyManagerIds } = await resolvePortalPmScope(
    supabase as any,
    token,
    "id, tenant_id, full_name, email"
  );
  if (!pm) return errorResponse("Invalid token.", 403);

  const { data: wo } = await supabase
    .from("work_orders")
    .select("id, title, properties(name)")
    .eq("id", work_order_id)
    .in("property_manager_id", propertyManagerIds)
    .single();
  if (!wo) return errorResponse("Work order not found.", 404);

  const { data: note, error } = await supabase
    .from("work_order_comments")
    .insert({
      tenant_id: pm.tenant_id,
      work_order_id,
      created_by_pm: pm.id,
      message,
    })
    .select("id, work_order_id, message, created_at, property_manager:property_managers!work_order_comments_created_by_pm_fkey(full_name)")
    .single();

  if (error) return errorResponse("Failed to add comment.", 500);

  const files = isMultipart
    ? body.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0)
    : [];

  const uploadedPhotos: WorkOrderPhoto[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse("Only JPEG, PNG, WebP, HEIC, and HEIF images are accepted.", 400);
    }
    if (file.size > 20 * 1024 * 1024) {
      return errorResponse("Each image must be under 20 MB.", 400);
    }

    const fileExt = EXT_MAP[file.type] ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `${pm.tenant_id}/work-orders/${work_order_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(filePath, file, { upsert: false });

    if (uploadError) return errorResponse("Failed to upload photo.", 500);

    const { data: publicUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
    uploadedPhotos.push({
      url: publicUrl.publicUrl,
      caption: file.name || null,
      created_at: new Date().toISOString(),
      uploaded_by_pm_id: pm.id,
      source: "comment",
      comment_id: note.id,
    });
  }

  if (uploadedPhotos.length > 0) {
    const { data: workOrder } = await supabase
      .from("work_orders")
      .select("photos")
      .eq("id", work_order_id)
      .in("property_manager_id", propertyManagerIds)
      .single();

    const existingPhotos = Array.isArray((workOrder as any)?.photos) ? (workOrder as any).photos : [];
    const { error: updateError } = await supabase
      .from("work_orders")
      .update({ photos: [...existingPhotos, ...uploadedPhotos] })
      .eq("id", work_order_id);

    if (updateError) return errorResponse("Failed to save comment photos.", 500);
  }

  if (resend && process.env.EMAIL_FROM) {
    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name")
        .eq("tenant_id", pm.tenant_id)
        .eq("role", "owner")
        .single(),
      supabase.from("tenants").select("name").eq("id", pm.tenant_id).single(),
    ]);

    if (owner?.email) {
      const property = Array.isArray((wo as any)?.properties) ? (wo as any).properties[0] : (wo as any)?.properties;
      const tenantName = tenant?.name || "Foreman";
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: owner.email,
        subject: `New PM comment: ${((wo as any)?.title as string) || "Work order"}`,
        html: renderEmailLayout({
          tenantName,
          category: "Portal Comment",
          title: "A property manager added a comment",
          greeting: `Hi ${owner.full_name || "there"},`,
          intro: `${pm.full_name} added a new comment to a work order.`,
          previewText: `${pm.full_name} commented on ${(wo as any)?.title || "a work order"}.`,
          sections: [
            renderNoticeCard({
              tone: "neutral",
              eyebrow: "Work order",
              title: ((wo as any)?.title as string) || "Work order",
              bodyHtml: property?.name ? `Property: ${property.name}` : undefined,
            }),
            renderDetailCard("Comment details", [
              { label: "Commented by", value: pm.full_name },
              { label: "Property", value: property?.name || "" },
              { label: "Photos", value: uploadedPhotos.length > 0 ? `${uploadedPhotos.length} attached` : "None" },
            ]),
            renderMessageCard("Comment", message),
          ],
          primaryAction: {
            href: `${appUrl}/owner/work-orders/${work_order_id}`,
            label: "Open work order",
          },
          footerText: "Review the work order in Foreman to respond or continue the conversation.",
        }),
      }).catch((err) => console.error("[email] portal comment:", err));
    }
  }

  return jsonResponse({ comment: note, photos: uploadedPhotos });
}
