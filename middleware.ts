import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
      console.warn("Supabase middleware error:", error);
    }
  }

  // Plan enforcement for owner routes.
  // /owner/settings is always accessible so expired users can reach the billing page.
  if (
    user &&
    pathname.startsWith("/owner") &&
    !pathname.startsWith("/owner/settings")
  ) {
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await service
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      const { data: tenant } = await service
        .from("tenants")
        .select("plan, trial_ends_at")
        .eq("id", profile.tenant_id)
        .single();

      if (tenant) {
        const isPro = tenant.plan === "pro";
        const trialActive =
          tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();

        if (!isPro && !trialActive) {
          const url = request.nextUrl.clone();
          url.pathname = "/owner/settings/billing";
          url.searchParams.set("expired", "true");
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // Forward the current pathname to server components via a request header.
  // Used by layouts that need to know the active route.
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/owner/:path*", "/worker/:path*"],
};
