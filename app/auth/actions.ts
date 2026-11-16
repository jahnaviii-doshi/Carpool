"use server";

import { redirect } from "next/navigation";

import { clearPendingEmail, getPendingEmail, setPendingEmail } from "@/lib/auth/pending-email";
import { fieldErrorsFrom, formToObject, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { otpSchema, signInSchema } from "@/lib/validation/auth";

type CheckResult =
  | { status: "ok"; college_name: string }
  | { status: "invalid" }
  | { status: "public_provider"; domain: string }
  | { status: "unknown_college"; domain: string };

/**
 * Step 1: check the email domain on the server, and only then send a code.
 * The database (auth hook + auth.users trigger) enforces the same rule, so
 * skipping this action and calling Supabase Auth directly does not help.
 */
export async function startSignIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const { email } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_signup_email", { p_email: email });
  if (error) return { message: "Something went wrong. Please try again." };

  const check = data as CheckResult;
  switch (check.status) {
    case "invalid":
      return { fieldErrors: { email: ["Enter a valid email address."] } };
    case "public_provider":
      return {
        fieldErrors: {
          email: [
            `${check.domain} is a personal email provider. Sign in with your college email instead.`,
          ],
        },
      };
    case "unknown_college":
      return {
        message: `Your college (${check.domain}) isn't on CampusPool yet.`,
        link: {
          href: `/request-college?email=${encodeURIComponent(email)}`,
          label: "Request it →",
        },
      };
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (otpError) {
    if (otpError.status === 429) {
      return { message: "Too many codes requested. Wait a minute and try again." };
    }
    return { message: otpError.message || "Could not send the code. Please try again." };
  }

  await setPendingEmail(email);
  redirect("/verify");
}

/** Step 2: verify the 6-digit code and record the verification time. */
export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = await getPendingEmail();
  if (!email) {
    return {
      message: "Your code expired. Enter your email again.",
      link: { href: "/", label: "Start again" },
    };
  }

  const parsed = otpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) {
    return { fieldErrors: { token: ["That code is wrong or has expired."] } };
  }

  const { error: recordError } = await supabase.rpc("record_email_verification");
  if (recordError) {
    await supabase.auth.signOut();
    return { message: "We couldn't confirm your sign-in. Please start again." };
  }

  await clearPendingEmail();
  redirect("/home");
}

export async function resendCode(): Promise<FormState> {
  const email = await getPendingEmail();
  if (!email) return { message: "Your code expired. Enter your email again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return {
      message:
        error.status === 429
          ? "Please wait a minute before asking for another code."
          : "Could not send a new code.",
    };
  }
  await setPendingEmail(email);
  return { ok: true, message: "We sent a new code." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Re-verification (spec §3.2): email a fresh code to the signed-in user's own
 * college address. Verifying it refreshes email_verified_at.
 */
export async function startReverification(): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/");

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });
  if (error) {
    return {
      message:
        error.status === 429
          ? "Please wait a minute before asking for another code."
          : "Could not send a code. If your college email no longer works, you can't re-verify.",
    };
  }
  await setPendingEmail(user.email);
  redirect("/verify");
}
