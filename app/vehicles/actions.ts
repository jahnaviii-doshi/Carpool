"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboarded } from "@/lib/auth/session";
import { safeNext } from "@/lib/college";
import { userMessage } from "@/lib/db-errors";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { readVehicleForm, vehicleSchema } from "@/lib/validation/rides";

export async function saveVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();
  const parsed = vehicleSchema.safeParse(readVehicleForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.rpc("save_vehicle", {
    p_id: v.id,
    p_type: v.type,
    p_make: v.make,
    p_model: v.model,
    p_color: v.color,
    p_seats: v.seats,
    p_plate_number: v.plateNumber,
  });
  if (error) return { message: userMessage(error) };

  redirect(safeNext(formData.get("next"), "/vehicles"));
}

export async function removeVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "Invalid vehicle." };

  const { error } = await supabase.rpc("remove_vehicle", { p_id: id.data });
  if (error) return { message: userMessage(error) };
  redirect("/vehicles");
}
