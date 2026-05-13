import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/logger";

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.resend.com https://*.sentry.io https://vitals.vercel-insights.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a per-request nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Auth validation — uses anon key + cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    if (error instanceof Error && error.name !== "AuthSessionMissingError") {
      logError("Supabase middleware error", error);
    }
  }

  // Portal route protection.
  // /portal/setup and /portal/estimate are intentionally public (token-gated flows).
  const isPortalRoute =
    pathname === "/portal" ||
    (pathname.startsWith("/portal/") &&
      !pathname.startsWith("/portal/setup") &&
      !pathname.startsWith("/portal/estimate") &&
      !pathname.startsWith("/portal/change-order") &&
      !pathname.startsWith("/portal/revoked"));

  if (isPortalRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Plan enforcement for owner routes.
  // /owner/settings is always accessible so expired users can reach billing.
  if (
    user &&
    pathname.startsWith("/owner") &&
    !pathname.startsWith("/owner/settings")
  ) {
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Single join query instead of two sequential queries
    const { data: profile } = await service
      .from("profiles")
      .select("tenant_id, tenants(plan, trial_ends_at)")
      .eq("id", user.id)
      .single();

    if (profile) {
      const tenantRaw = profile.tenants as unknown;
      const tenant = (Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw) as { plan: string; trial_ends_at: string | null } | null;
      const isPro = tenant?.plan === "pro" || tenant?.plan === "comped";
      const trialActive = tenant?.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();

      if (!isPro && !trialActive) {
        const url = request.nextUrl.clone();
        url.pathname = "/owner/settings/billing";
        url.searchParams.set("expired", "true");
        return NextResponse.redirect(url);
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf)).*)",
  ],
};
