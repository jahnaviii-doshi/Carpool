import "server-only";

import type { LatLng, Place } from "@/lib/geo/types";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type CollegeContext = {
  id: string;
  name: string;
  shortName: string;
  timeZone: string;
  currency: string;
  costSharingEnabled: boolean;
  campus: LatLng | null;
  /** The campus as a pickable place ("AUS campus"). */
  campusPlace: Place | null;
};

/** The signed-in user's college settings (via the my_college view). */
export async function getCollegeContext(supabase: Client): Promise<CollegeContext> {
  const { data, error } = await supabase.from("my_college").select("*").single();
  if (error || !data?.id) throw new Error("Could not load your college.");

  const campus =
    data.campus_lat != null && data.campus_lng != null
      ? { lat: data.campus_lat, lng: data.campus_lng }
      : null;

  return {
    id: data.id,
    name: data.name ?? "",
    shortName: data.short_name ?? "",
    timeZone: data.timezone ?? "Asia/Dubai",
    currency: data.currency ?? "AED",
    costSharingEnabled: data.cost_sharing_enabled ?? false,
    campus,
    campusPlace: campus
      ? {
          ...campus,
          label: `${data.short_name} campus`,
          area: `${data.short_name} campus`,
        }
      : null,
  };
}

/** Only allow same-site relative redirects (`/offer`, not `//evil.com`). */
export function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?!\/)[\w\-/?=&]*$/.test(next) ? next : fallback;
}
