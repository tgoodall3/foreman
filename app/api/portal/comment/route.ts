// Placeholder endpoint (comments require schema update). Keeps route stable without DB changes.
import { errorResponse, jsonResponse } from "@/lib/api";
import { NextRequest } from "next/server";

export async function POST(_: NextRequest) {
  // Return a neutral response; comments not yet implemented in DB schema.
  return jsonResponse({ ok: false, message: "Comments not enabled." });
}
