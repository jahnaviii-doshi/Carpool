import { areaFromComponents, shortLabel, type AddressComponent } from "@/lib/geo/area";
import type { Geocoder, LatLng, Place, SearchOptions } from "@/lib/geo/types";

type OlaPrediction = {
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
  geometry?: { location?: { lat: number; lng: number } };
  terms?: { value: string }[];
};

type OlaReverseResult = {
  formatted_address: string;
  address_components?: AddressComponent[];
  geometry?: { location?: { lat: number; lng: number } };
};

export function placeFromOlaPrediction(p: OlaPrediction): Place | null {
  const loc = p.geometry?.location;
  if (!loc) return null;
  // Terms run from most to least specific; [-3] is typically the
  // neighbourhood and [-2] the city.
  const terms = (p.terms ?? []).map((t) => t.value);
  const area =
    terms.length >= 3
      ? `${terms[terms.length - 3]}, ${terms[terms.length - 2]}`
      : (p.structured_formatting?.secondary_text ?? null);
  return {
    lat: loc.lat,
    lng: loc.lng,
    label: shortLabel(p.description),
    area: area?.slice(0, 120) ?? null,
  };
}

/**
 * Ola Maps Places API. Coverage is strongest in India; for UAE colleges
 * Google is the better production choice.
 */
export class OlaGeocoder implements Geocoder {
  readonly name = "ola";
  private readonly base = "https://api.olamaps.io/places/v1";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const url = new URL(`${this.base}/autocomplete`);
    url.searchParams.set("input", query);
    url.searchParams.set("api_key", this.apiKey);
    if (options.near) url.searchParams.set("location", `${options.near.lat},${options.near.lng}`);
    const res = await this.fetchImpl(url, { headers: { "X-Request-Id": crypto.randomUUID() } });
    if (!res.ok) throw new Error(`Ola autocomplete failed: ${res.status}`);
    const json = (await res.json()) as { predictions?: OlaPrediction[] };
    return (json.predictions ?? [])
      .map(placeFromOlaPrediction)
      .filter((p): p is Place => p !== null)
      .slice(0, options.limit ?? 6);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const url = new URL(`${this.base}/reverse-geocode`);
    url.searchParams.set("latlng", `${point.lat},${point.lng}`);
    url.searchParams.set("api_key", this.apiKey);
    const res = await this.fetchImpl(url, { headers: { "X-Request-Id": crypto.randomUUID() } });
    if (!res.ok) throw new Error(`Ola reverse geocode failed: ${res.status}`);
    const json = (await res.json()) as { results?: OlaReverseResult[] };
    const first = json.results?.[0];
    if (!first) return null;
    return {
      lat: point.lat,
      lng: point.lng,
      label: shortLabel(first.formatted_address),
      area: areaFromComponents(first.address_components),
    };
  }
}
