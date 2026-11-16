import type { LatLng } from "@/lib/geo/types";

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distance for display to other users. Rounded to 0.5 km (minimum "under
 * 1 km") so repeated searches can't be used to triangulate a fuzzed point.
 */
export function approxDistanceLabel(metres: number): string {
  if (metres < 1000) return "under 1 km";
  const halfKm = Math.round(metres / 500) / 2;
  return `about ${halfKm.toFixed(halfKm % 1 === 0 ? 0 : 1)} km`;
}

export function isValidLatLng(p: Partial<LatLng>): p is LatLng {
  return (
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
