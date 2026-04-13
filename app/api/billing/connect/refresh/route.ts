import { NextRequest, NextResponse } from "next/server";

// Stripe redirects here if the account link expires.
// Just send the user back to billing so they can restart.
export function GET(req: NextRequest) {
  const rawEnvUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  const siteUrl = rawEnvUrl && rawEnvUrl !== "undefined" ? rawEnvUrl : req.nextUrl?.origin;
  return NextResponse.redirect(`${siteUrl}/owner/settings/billing?connect=expired`);
}
