import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/logger";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
      const isPro = tenant?.plan === "pro";
      const trialActive = tenant?.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();

      if (!isPro && !trialActive) {
        const url = request.nextUrl.clone();
        url.pathname = "/owner/settings/billing";
        url.searchParams.set("expired", "true");
        return NextResponse.redirect(url);
      }
    }
  }

  // Pass current pathname and user ID to server components via request headers.
  // x-user-id lets getCurrentProfile skip auth.getUser() on owner/worker routes.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  if (user?.id) requestHeaders.set("x-user-id", user.id);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/owner/:path*", "/worker/:path*", "/portal", "/portal/:path*"],
};
