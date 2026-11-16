import "server-only";
import { cookies } from "next/headers";

/**
 * The address a code was just sent to, kept in a short-lived httpOnly cookie
 * rather than the URL so it doesn't end up in history, logs or referrers.
 */
const COOKIE = "cp_pending_email";
const TEN_MINUTES = 60 * 10;

export async function setPendingEmail(email: string) {
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEN_MINUTES,
  });
}

export async function getPendingEmail(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function clearPendingEmail() {
  (await cookies()).delete(COOKIE);
}
