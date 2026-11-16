import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/** Routes that need a signed-in user. Finer checks happen in each page. */
const PROTECTED = ["/home", "/onboarding", "/admin"];
/** Routes a signed-in user has no reason to see. */
const SIGNED_OUT_ONLY = ["/"];

/**
 * Refreshes the Supabase session cookie on every request and does the cheap
 * signed-in / signed-out redirects. Authorisation itself lives in RLS.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not put code between createServerClient and getUser (see @supabase/ssr docs).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    return redirectKeepingCookies(request, response, "/");
  }
  if (user && SIGNED_OUT_ONLY.includes(path)) {
    return redirectKeepingCookies(request, response, "/home");
  }

  return response;
}

function redirectKeepingCookies(request: NextRequest, from: NextResponse, to: string) {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
