import { haversineM } from "@/lib/geo/distance";
import type { Geocoder, LatLng, Place } from "@/lib/geo/types";

/**
 * Offline geocoder with a few well-known places around AUS. Used for
 * automated tests, CI and development without network access
 * (GEOCODER_PROVIDER=fixture). Coordinates are approximate.
 */
export const FIXTURE_PLACES: Place[] = [
  {
    label: "AUS Main Gate, University City, Sharjah",
    area: "University City, Sharjah",
    lat: 25.312,
    lng: 55.4905,
  },
  {
    label: "University City Hall, Sharjah",
    area: "University City, Sharjah",
    lat: 25.3056,
    lng: 55.4693,
  },
  { label: "Al Nahda Park, Al Nahda, Sharjah", area: "Al Nahda, Sharjah", lat: 25.305, lng: 55.37 },
  {
    label: "Sahara Centre, Al Nahda, Sharjah",
    area: "Al Nahda, Sharjah",
    lat: 25.2975,
    lng: 55.3735,
  },
  { label: "Muwaileh Commercial, Sharjah", area: "Muwaileh, Sharjah", lat: 25.3, lng: 55.45 },
  { label: "Al Majaz Waterfront, Sharjah", area: "Al Majaz, Sharjah", lat: 25.3263, lng: 55.3853 },
  {
    label: "City Centre Sharjah, Al Taawun",
    area: "Al Taawun, Sharjah",
    lat: 25.3255,
    lng: 55.3925,
  },
  { label: "Al Qasimia, Sharjah", area: "Al Qasimia, Sharjah", lat: 25.347, lng: 55.401 },
  { label: "Ajman City Centre, Ajman", area: "Al Jurf, Ajman", lat: 25.4085, lng: 55.5129 },
  { label: "Al Qusais Metro Station, Dubai", area: "Al Qusais, Dubai", lat: 25.2707, lng: 55.3854 },
  { label: "Deira City Centre, Dubai", area: "Port Saeed, Dubai", lat: 25.2523, lng: 55.3311 },
  {
    label: "Dubai International Academic City",
    area: "Academic City, Dubai",
    lat: 25.1278,
    lng: 55.4164,
  },
];

export class FixtureGeocoder implements Geocoder {
  readonly name = "fixture";

  async search(query: string, options: { limit?: number } = {}): Promise<Place[]> {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return FIXTURE_PLACES.filter((p) =>
      words.every((w) => p.label.toLowerCase().includes(w)),
    ).slice(0, options.limit ?? 6);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const nearest = [...FIXTURE_PLACES].sort(
      (a, b) => haversineM(a, point) - haversineM(b, point),
    )[0];
    if (!nearest || haversineM(nearest, point) > 5000) {
      return { ...point, label: "Pinned location", area: null };
    }
    return { ...point, label: `Pinned location near ${nearest.label}`, area: nearest.area };
  }
}
