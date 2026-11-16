"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboarded } from "@/lib/auth/session";
import { userMessage } from "@/lib/db-errors";
import { fieldErrorsFrom, type FormState } from "@/lib/forms";
import { routeOrStraightLine, thinRoute } from "@/lib/geo/routers";
import { getRouter } from "@/lib/geo/server";
import { offerSchema, readOfferForm } from "@/lib/validation/rides";

export async function saveOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();

  const parsed = offerSchema.safeParse(readOfferForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  // Real road route when a router is configured; otherwise the database
  // uses the straight line origin → destination.
  const router = getRouter();
  let routeGeoJson: string | undefined;
  if (router.name !== "straight-line") {
    const route = await routeOrStraightLine(router, v.origin, v.dest);
    if (route.coordinates.length > 2) {
      routeGeoJson = JSON.stringify({
        type: "LineString",
        coordinates: thinRoute(route.coordinates),
      });
    }
  }

  const { data: offerId, error } = await supabase.rpc("save_ride_offer", {
    p_id: v.id,
    p_vehicle_id: v.vehicleId,
    p_origin_lat: v.origin.lat,
    p_origin_lng: v.origin.lng,
    p_origin_label: v.origin.label,
    p_origin_area: v.origin.area,
    p_dest_lat: v.dest.lat,
    p_dest_lng: v.dest.lng,
    p_dest_label: v.dest.label,
    p_dest_area: v.dest.area,
    p_depart_local: `${v.date}T${v.time}:00`,
    p_flex_minutes: v.flexMinutes,
    p_seats_total: v.seats,
    p_recurring_days: v.repeat ? v.recurringDays : undefined,
    p_recurring_until: v.repeat ? v.recurringUntil : undefined,
    p_cost_per_seat: v.costPerSeat,
    p_women_only: v.womenOnly,
    p_notes: v.notes,
    p_route_geojson: routeGeoJson,
  });
  if (error) return { message: userMessage(error) };

  redirect(`/offers/${offerId}?saved=${v.id ? "updated" : "1"}`);
}

export async function cancelOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOnboarded();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { message: "Invalid ride." };
  const { error } = await supabase.rpc("cancel_ride_offer", { p_id: id.data });
  if (error) return { message: userMessage(error) };
  redirect("/rides?cancelled=1");
}
