import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set() {
          /* no-op in middleware */
        },
        remove() {
          /* no-op in middleware */
        },
      },
    }
  );

  try {
    await supabase.auth.getUser();
  } catch (error) {
    // AuthSessionMissingError is expected for unauthenticated requests.
    if (error instanceof Error && error.name !== "AuthSessionMissingError") {
      console.warn("Supabase middleware error:", error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/worker/:path*"],
};
