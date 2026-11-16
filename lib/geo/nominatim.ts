import { coarseArea, shortLabel } from "@/lib/geo/area";
import type { Geocoder, LatLng, Place, SearchOptions } from "@/lib/geo/types";

type NominatimAddress = Partial<
  Record<
    | "suburb"
    | "neighbourhood"
    | "quarter"
    | "residential"
    | "city_district"
    | "city"
    | "town"
    | "village"
    | "state",
    string
  >
>;

export type NominatimItem = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: NominatimAddress;
};

export function placeFromNominatim(item: NominatimItem): Place {
  const a = item.address ?? {};
  const label =
    item.name && !item.display_name.startsWith(item.name)
      ? `${item.name}, ${shortLabel(item.display_name, 2)}`
      : shortLabel(item.display_name);
  return {
    lat: Number(item.lat),
    lng: Number(item.lon),
    label,
    area: coarseArea({
      neighbourhood: [a.suburb, a.neighbourhood, a.quarter, a.residential, a.city_district],
      city: [a.city, a.town, a.village, a.state],
    }),
  };
}

/**
 * OpenStreetMap Nominatim. The public server allows at most 1 request per
 * second and needs an identifying User-Agent; callers must throttle and cache
 * (see lib/geo/server.ts). Fine for development and small pilots only.
 */
export class NominatimGeocoder implements Geocoder {
  readonly name = "nominatim";

  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent, "Accept-Language": "en" },
    });
    if (!res.ok) throw new Error(`Nominatim ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const params: Record<string, string> = {
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: String(options.limit ?? 6),
    };
    if (options.countryCodes?.length) params.countrycodes = options.countryCodes.join(",");
    if (options.near) {
      const d = 0.6; // ~60 km box, preferred but not exclusive (bounded=0)
      const { lat, lng } = options.near;
      params.viewbox = [lng - d, lat + d, lng + d, lat - d].join(",");
      params.bounded = "0";
    }
    const items = await this.get<NominatimItem[]>("/search", params);
    return items.map(placeFromNominatim);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const item = await this.get<NominatimItem & { error?: string }>("/reverse", {
      lat: String(point.lat),
      lon: String(point.lng),
      format: "jsonv2",
      addressdetails: "1",
      zoom: "18",
    });
    if (item.error) return null;
    // Keep the exact point the user tapped, not the snapped address.
    return { ...placeFromNominatim(item), lat: point.lat, lng: point.lng };
  }
}
