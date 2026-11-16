"use server";

import { userMessage } from "@/lib/db-errors";
import { fieldErrorsFrom, formToObject, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { collegeRequestSchema } from "@/lib/validation/auth";

export async function submitCollegeRequest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = collegeRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_college_request", {
    p_email: v.email,
    p_college_name: v.collegeName,
    p_city: v.city,
    p_domains: v.domains,
    p_website: v.website,
  });
  if (error) return { message: userMessage(error) };

  return {
    ok: true,
    message:
      "Thanks! We'll review your request and email you when your college is added. This usually takes a few days.",
  };
}
