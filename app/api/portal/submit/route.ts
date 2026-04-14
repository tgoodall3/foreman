import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateInput, portalSubmitSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
import { getPortalPm } from "@/lib/portal";
import { renderDetailCard, renderEmailLayout, renderMessageCard, renderNoticeCard } from "@/lib/email";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

type UploadedPhoto = {
  url: string;
  caption: string | null;
  created_at: string;
  uploaded_by_pm_id: string;
  source: "submission" | "comment";
};

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

async function uploadWorkOrderPhotos(
  supabase: ReturnType<typeof createServiceClient>,
  files: File[],
  tenantId: string,
  workOrderId: string,
  pmId: string,
  source: "submission" | "comment"
) {
  const uploaded: UploadedPhoto[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Only JPEG, PNG, WebP, HEIC, and HEIF images are accepted.");
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("Each image must be under 20 MB.");
    }

    const fileExt = EXT_MAP[file.type] ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    const filePath = `${tenantId}/work-orders/${workOrderId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("job-photos")
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      throw new Error("Failed to upload photo.");
    }

    const { data: publicUrl } = supabase.storage.from("job-photos").getPublicUrl(filePath);
    uploaded.push({
      url: publicUrl.publicUrl,
      caption: file.name || null,
      created_at: new Date().toISOString(),
      uploaded_by_pm_id: pmId,
      source,
    });
  }

  return uploaded;
}

export async function POST(req: NextRequest) {
  try {
    // Identity is resolved from the session — never from the client body.
    const pm = await getPortalPm();
    if (!pm) return errorResponse("Unauthorized", 401);

    const isMultipart = req.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart ? await req.formData() : await req.json();

    const payload = isMultipart
      ? {
          property_id: asString(body.get("property_id")),
          title: asString(body.get("title")),
          description: asString(body.get("description")),
          priority: asString(body.get("priority")),
        }
      : body;

    const validation = validateInput(portalSubmitSchema, payload);
    if (!validation.success) {
      return errorResponse((validation as any).error, 400);
    }

    const { property_id, title, description, priority } = validation.data;

    const supabase = createServiceClient();

    // Rate limit: max 5 submissions per PM per hour.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("property_manager_id", pm.id)
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 5) {
      return errorResponse("Too many submissions. Please wait before submitting again.", 429);
    }

    // Verify the property belongs to this PM and tenant.
    const { data: prop } = await supabase
      .from("properties")
      .select("id, name, address")
      .eq("id", property_id)
      .eq("tenant_id", pm.tenant_id)
      .eq("property_manager_id", pm.id)
      .single();

    if (!prop) return errorResponse("Property not found", 404);

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .insert({
        tenant_id: pm.tenant_id,
        property_id,
        property_manager_id: pm.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: "pending",
      })
      .select("*, properties(name, address), property_managers(full_name, email)")
      .single();

    if (error) return errorResponse("Failed to create work order", 500);

    const files = isMultipart
      ? body.getAll("photos").filter((entry: FormDataEntryValue): entry is File => entry instanceof File && entry.size > 0)
      : [];

    if (files.length > 0) {
      const uploadedPhotos = await uploadWorkOrderPhotos(
        supabase,
        files,
        pm.tenant_id,
        workOrder.id,
        pm.id,
        "submission"
      );

      const { error: photosError } = await supabase
        .from("work_orders")
        .update({ photos: uploadedPhotos })
        .eq("id", workOrder.id);

      if (photosError) return errorResponse("Failed to save work order photos", 500);
      (workOrder as any).photos = uploadedPhotos;
    } else {
      (workOrder as any).photos = [];
    }

    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("tenant_id", pm.tenant_id).eq("role", "owner").single(),
      supabase.from("tenants").select("name").eq("id", pm.tenant_id).single(),
    ]);

    const tenantName = tenant?.name || "Foreman";
    const fromAddress = `${tenantName} <${process.env.EMAIL_FROM!}>`;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const property = Array.isArray((workOrder as any).properties)
      ? (workOrder as any).properties[0]
      : (workOrder as any).properties;
    const propertyManager = Array.isArray((workOrder as any).property_managers)
      ? (workOrder as any).property_managers[0]
      : (workOrder as any).property_managers;

    if (owner?.email && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: fromAddress,
        to: owner.email,
        subject: `New Work Order: ${title}`,
        html: renderEmailLayout({
          tenantName,
          category: "Portal Work Order",
          title: "New work order submitted",
          greeting: `Hi ${owner.full_name || "there"},`,
          intro: `${propertyManager?.full_name || "A property manager"} submitted a new work order through the portal.`,
          previewText: `${propertyManager?.full_name || "A property manager"} submitted ${title}.`,
          sections: [
            renderNoticeCard({
              tone: priority === "urgent" || priority === "high" ? "warning" : "neutral",
              eyebrow: `Priority ${priority.toUpperCase()}`,
              title,
              bodyHtml: property?.name
                ? `For ${property.name}${property.address ? ` at ${property.address}` : ""}.`
                : undefined,
            }),
            renderDetailCard("Request details", [
              { label: "Submitted by", value: propertyManager?.full_name || "Property manager" },
              { label: "Property", value: property?.name || "Unknown property" },
              { label: "Address", value: property?.address || "" },
            ]),
            renderMessageCard("Reported issue", description),
            files.length > 0
              ? renderNoticeCard({
                  tone: "neutral",
                  eyebrow: "Attachments",
                  title: `${files.length} photo${files.length === 1 ? "" : "s"} included`,
                  body: "Open the work order to review the uploaded images.",
                })
              : "",
          ],
          primaryAction: {
            href: `${appUrl}/owner/work-orders/${workOrder.id}`,
            label: "Review work order",
          },
          footerText: "Review the request in Foreman or reply to this email if you need clarification.",
        }),
      });

      if (propertyManager?.email) {
        await resend.emails.send({
          from: fromAddress,
          to: propertyManager.email,
          subject: `Work Order Received: ${title}`,
          html: renderEmailLayout({
            tenantName,
            category: "Portal Confirmation",
            title: "We received your work order",
            greeting: `Hi ${propertyManager.full_name || "there"},`,
            intro: "Your request is in review. We will follow up as soon as the team has assessed it.",
            previewText: `Your work order ${title} was submitted successfully.`,
            sections: [
              renderNoticeCard({
                tone: "success",
                eyebrow: "Submission received",
                title,
                bodyHtml: property?.name ? `Property: ${property.name}` : undefined,
              }),
              renderDetailCard("Request details", [
                { label: "Priority", value: priority },
                { label: "Property", value: property?.name || "Unknown property" },
                { label: "Address", value: property?.address || "" },
              ]),
              renderMessageCard("Issue summary", description),
              files.length > 0
                ? renderNoticeCard({
                    tone: "neutral",
                    eyebrow: "Attachments",
                    title: `${files.length} photo${files.length === 1 ? "" : "s"} uploaded`,
                    body: "These images were attached to your submission for reference.",
                  })
                : "",
            ],
            footerText: "You will receive updates by email as the work order moves forward.",
          }),
        });
      }
    }

    return NextResponse.json({ success: true, id: workOrder.id, workOrder });
  } catch (error) {
    console.error("Portal submit error:", error);
    return errorResponse("Internal server error", 500);
  }
}
