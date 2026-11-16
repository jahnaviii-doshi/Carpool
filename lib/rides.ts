import "server-only";

import type { Place } from "@/lib/geo/types";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadVehicleOptions(supabase: Client) {
  const { data } = await supabase
    .from("vehicles")
    .select("id, make, model, color, seats")
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []).map((v) => ({
    id: v.id,
    label: `${v.color} ${v.make} ${v.model}`,
    seats: v.seats,
  }));
}

/** Builds a Place from a my_offers / my_requests row's columns. */
export function placeFrom(
  lat: number | null,
  lng: number | null,
  label: string | null,
  area: string | null,
): Place | null {
  return lat != null && lng != null && label ? { lat, lng, label, area } : null;
}
