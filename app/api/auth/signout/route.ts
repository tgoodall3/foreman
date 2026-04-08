import { NextRequest, NextResponse } from "next/server";
import { createServerSideClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerSideClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}
