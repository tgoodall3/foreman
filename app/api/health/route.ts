import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { validateEnv } from "@/lib/env";

export async function GET() {
  try {
    // Check environment
    const envCheck = validateEnv();
    if (!envCheck.valid) {
      return NextResponse.json({ status: "error", environment: "invalid" }, { status: 500 });
    }

    // Check database connection
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("tenants").select("id").limit(1);

    if (error) {
      return NextResponse.json({ status: "error", database: "unhealthy" }, { status: 500 });
    }

    return NextResponse.json({
      status: "ok",
      environment: "valid",
      database: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  } catch (error) {
    return NextResponse.json({ status: "error", message: "Service unavailable" }, { status: 500 });
  }
}