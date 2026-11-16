/** Shared geo types. Coordinates are WGS84 degrees. */
export type LatLng = { lat: number; lng: number };

/**
 * A place chosen by the user.
 * - `label` is the exact, private description ("Villa 12, Street 5, Al Nahda").
 * - `area` is the coarse, public one ("Al Nahda, Sharjah"), shown to others.
 */
export type Place = LatLng & { label: string; area: string | null };

export type SearchOptions = {
  /** Bias results towards this point (the user's campus). */
  near?: LatLng;
  /** ISO 3166-1 alpha-2 codes, lower-case (e.g. ["ae"]). */
  countryCodes?: string[];
  limit?: number;
};

/** Address search and reverse geocoding. Implementations run on the server only. */
export interface Geocoder {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
}

/** A driving route as GeoJSON-order coordinates ([lng, lat]). */
export type Route = { coordinates: [number, number][]; distanceM: number };

/** Turn-by-turn routing is optional; StraightLineRouter is the fallback. */
export interface Router {
  readonly name: string;
  route(from: LatLng, to: LatLng): Promise<Route>;
}

/** Map tiles for Leaflet. */
export interface MapProvider {
  tileUrl: string;
  attribution: string;
  maxZoom: number;
}
