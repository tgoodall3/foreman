import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let token: string | undefined;
  let status: string | undefined;
  let signatureName: string | undefined;

  if (isJson) {
    const body = await req.json().catch(() => ({}));
    token     = body.token;
    status    = body.status;
    signatureName = body.signature_name;
  } else {
    const formData = await req.formData();
    token     = formData.get("token")?.toString();
    status    = formData.get("status")?.toString();
    signatureName = formData.get("signature_name")?.toString();
  }

  if (!token || !status || !["approved", "declined"].includes(status)) {
    if (isJson) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    return NextResponse.redirect(new URL(`/portal/estimate?token=${token || ""}&result=error`, process.env.NEXT_PUBLIC_SITE_URL));
  }

  const supabase = createServiceClient();

  const update: Record<string, string> = { status };
  if (status === "approved" && signatureName) {
    update.signature_name = signatureName;
    update.signed_at = new Date().toISOString();
  }

  await supabase
    .from("estimates")
    .update(update)
    .eq("approval_token", token);

  if (isJson) return NextResponse.json({ ok: true, status });
  return NextResponse.redirect(new URL(`/portal/estimate?token=${token}&result=${status}`, process.env.NEXT_PUBLIC_SITE_URL));
}
