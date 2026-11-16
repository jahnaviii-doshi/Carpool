"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboarded } from "@/lib/auth/session";
import { userMessage } from "@/lib/db-errors";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { readRequestForm, requestSchema } from "@/lib/validation/rides";

export async function saveRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();

  const parsed = requestSchema.safeParse(readRequestForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const { data: requestId, error } = await supabase.rpc("save_ride_request", {
    p_id: v.id,
    p_pickup_lat: v.pickup.lat,
    p_pickup_lng: v.pickup.lng,
    p_pickup_label: v.pickup.label,
    p_pickup_area: v.pickup.area,
    p_dest_lat: v.dest.lat,
    p_dest_lng: v.dest.lng,
    p_dest_label: v.dest.label,
    p_dest_area: v.dest.area,
    p_date: v.date,
    p_window_start: v.windowStart,
    p_window_end: v.windowEnd,
    p_seats_needed: v.seatsNeeded,
    p_women_only_pref: v.womenOnlyPref,
    p_recurring_days: v.repeat ? v.recurringDays : undefined,
    p_recurring_until: v.repeat ? v.recurringUntil : undefined,
    p_notes: v.notes,
  });
  if (error) return { message: userMessage(error) };

  redirect(`/requests/${requestId}?saved=${v.id ? "updated" : "1"}`);
}

export async function cancelRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "Invalid request." };
  const { error } = await supabase.rpc("cancel_ride_request", { p_id: id.data });
  if (error) return { message: userMessage(error) };
  redirect("/rides?cancelled=1");
}
