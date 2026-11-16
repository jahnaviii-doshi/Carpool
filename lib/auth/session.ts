import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, their own profile row and their college. Cached per
 * request. `getUser()` re-validates the JWT with Supabase Auth, so this is
 * safe to rely on for access decisions on the server.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: canWrite }, { data: isSuperAdmin }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, college:colleges(id, name, short_name, city)")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("can_write"),
    supabase.rpc("is_super_admin"),
  ]);

  return {
    supabase,
    user,
    profile,
    canWrite: canWrite === true,
    isSuperAdmin: isSuperAdmin === true,
  };
});

/** Signed in and verified by OTP; otherwise back to the sign-in screen. */
export async function requireVerified() {
  const session = await getSession();
  if (!session?.profile?.email_verified_at) redirect("/");
  return { ...session, profile: session.profile };
}

/** Verified and onboarded; otherwise to whichever step is missing. */
export async function requireOnboarded() {
  const session = await requireVerified();
  if (!session.profile.onboarded_at) redirect("/onboarding");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireOnboarded();
  if (!session.isSuperAdmin) redirect("/home");
  return session;
}
