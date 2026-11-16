"use server";

import { redirect } from "next/navigation";

import { requireVerified } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { onboardingSchema, readOnboardingForm } from "@/lib/validation/auth";

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireVerified();

  const parsed = onboardingSchema.safeParse(readOnboardingForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("complete_onboarding", {
    p_full_name: v.fullName,
    p_phone_e164: v.phone,
    p_role: v.role,
    p_gender: v.gender,
    p_year_or_dept: v.yearOrDept || undefined,
    p_accept_terms: v.acceptTerms,
  });
  if (error) {
    return { message: "We couldn't save your profile. Check the details and try again." };
  }

  redirect("/home");
}
