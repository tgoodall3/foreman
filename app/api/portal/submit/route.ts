import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateInput, portalSubmitSchema } from "@/lib/validation";
import { errorResponse } from "@/lib/api";
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
    const isMultipart = req.headers.get("content-type")?.includes("multipart/form-data");
    const body = isMultipart
      ? await req.formData()
      : await req.json();

    const payload = isMultipart
      ? {
          property_manager_id: asString(body.get("property_manager_id")),
          tenant_id: asString(body.get("tenant_id")),
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

    const { property_manager_id, tenant_id, property_id, title, description, priority } = validation.data;

    const supabase = createServiceClient();

    // Rate limit: 5 submissions per PM per hour (counted via DB)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("property_manager_id", property_manager_id)
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 5) {
      return errorResponse("Too many submissions. Please wait before submitting again.", 429);
    }

    // Verify property manager and property belong to tenant
    const { data: pm } = await supabase
      .from("property_managers")
      .select("id, full_name, email")
      .eq("id", property_manager_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!pm) return errorResponse("Property manager not found", 404);

    const { data: prop } = await supabase
      .from("properties")
      .select("id, name, address")
      .eq("id", property_id)
      .eq("tenant_id", tenant_id)
      .eq("property_manager_id", property_manager_id)
      .single();

    if (!prop) return errorResponse("Property not found", 404);

    // Insert work order
    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .insert({
        tenant_id,
        property_id,
        property_manager_id,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: "pending",
      })
      .select("*, properties(name, address), property_managers(full_name, email)")
      .single();

    if (error) return errorResponse("Failed to create work order", 500);

    const files = isMultipart
      ? body.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0)
      : [];

    if (files.length > 0) {
      const uploadedPhotos = await uploadWorkOrderPhotos(
        supabase,
        files,
        tenant_id,
        workOrder.id,
        property_manager_id,
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

    // Get owner email + tenant name
    const [{ data: owner }, { data: tenant }] = await Promise.all([
      supabase.from("profiles").select("email, full_name").eq("tenant_id", tenant_id).eq("role", "owner").single(),
      supabase.from("tenants").select("name").eq("id", tenant_id).single(),
    ]);

    const tenantName = tenant?.name || "Foreman";
    const fromAddress = `${tenantName} <${process.env.EMAIL_FROM!}>`;

    // Send notification to owner
    if (owner?.email && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: fromAddress,
        to: owner.email,
        subject: `New Work Order: ${title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 560px;">
            <h2 style="color: #0f1923;">New Work Order Submitted</h2>
            <p><strong>From:</strong> ${workOrder.property_managers?.full_name}</p>
            <p><strong>Property:</strong> ${workOrder.properties?.name} — ${workOrder.properties?.address}</p>
            <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
            <h3>${title}</h3>
            <p>${description}</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/owner/work-orders/${workOrder.id}" 
               style="display:inline-block; background:#f59e0b; color:#0f1923; padding:10px 20px; border-radius:8px; font-weight:700; text-decoration:none; margin-top:16px;">
              View Work Order →
            </a>
          </div>
        `,
      });

      // Send confirmation to property manager
      if (workOrder.property_managers?.email) {
        await resend.emails.send({
          from: fromAddress,
          to: workOrder.property_managers.email,
          subject: `Work Order Received: ${title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px;">
              <h2 style="color: #0f1923;">Work Order Received</h2>
              <p>Hi ${workOrder.property_managers.full_name},</p>
              <p>Your work order has been submitted and will be reviewed shortly.</p>
              <p><strong>Property:</strong> ${workOrder.properties?.name}</p>
              <p><strong>Issue:</strong> ${title}</p>
              <p><strong>Priority:</strong> ${priority}</p>
              <p>You'll receive updates as work progresses.</p>
            </div>
          `,
        });
      }
    }

    return NextResponse.json({ success: true, id: workOrder.id, workOrder });
  } catch (error) {
    console.error("Portal submit error:", error);
    return errorResponse("Internal server error", 500);
  }
}
