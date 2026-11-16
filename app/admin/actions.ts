"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/session";
import { userMessage } from "@/lib/db-errors";
import { fieldErrorsFrom, formToObject, type FormState } from "@/lib/forms";
import { approveCollegeSchema } from "@/lib/validation/auth";

// requireSuperAdmin() is a convenience check; the RPCs re-check is_super_admin()
// in the database, which is what actually protects these operations.

export async function approveCollege(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperAdmin();

  const parsed = approveCollegeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("approve_college_request", {
    p_request_id: v.requestId,
    p_name: v.name,
    p_short_name: v.shortName,
    p_city: v.city,
    p_domains: v.domains,
    p_country_code: v.countryCode,
    p_campus_lat: v.lat,
    p_campus_lng: v.lng,
  });
  if (error) return { message: userMessage(error) };

  // The request leaves the pending list, so confirm at the top of the page.
  redirect(`/admin?approved=${encodeURIComponent(v.name)}`);
}

export async function rejectCollege(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperAdmin();

  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) return { message: "Invalid request." };

  const { error } = await supabase.rpc("reject_college_request", { p_request_id: id.data });
  if (error) return { message: userMessage(error) };

  redirect("/admin?rejected=1");
}
