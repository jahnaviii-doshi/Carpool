import { areaFromComponents, shortLabel, type AddressComponent } from "@/lib/geo/area";
import type { Geocoder, LatLng, Place, SearchOptions } from "@/lib/geo/types";

type TextSearchPlace = {
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  addressComponents?: AddressComponent[];
};

type GeocodeResult = {
  formatted_address: string;
  address_components: AddressComponent[];
  geometry: { location: { lat: number; lng: number } };
};

export function placeFromGoogleTextSearch(p: TextSearchPlace): Place {
  const name = p.displayName?.text;
  const address = p.formattedAddress ?? "";
  return {
    lat: p.location.latitude,
    lng: p.location.longitude,
    label: shortLabel(
      name && !address.startsWith(name) ? `${name}, ${address}` : address || name || "",
    ),
    area: areaFromComponents(p.addressComponents),
  };
}

export function placeFromGeocodeResult(r: GeocodeResult): Place {
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    label: shortLabel(r.formatted_address),
    area: areaFromComponents(r.address_components),
  };
}

/** Google Places API (New) Text Search + Geocoding API for reverse lookups. */
export class GoogleGeocoder implements Geocoder {
  readonly name = "google";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const body: Record<string, unknown> = {
      textQuery: query,
      maxResultCount: options.limit ?? 6,
      languageCode: "en",
    };
    if (options.countryCodes?.length === 1) body.regionCode = options.countryCodes[0].toUpperCase();
    if (options.near) {
      body.locationBias = {
        circle: {
          center: { latitude: options.near.lat, longitude: options.near.lng },
          radius: 50_000,
        },
      };
    }
    const res = await this.fetchImpl("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.addressComponents",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google text search failed: ${res.status}`);
    const json = (await res.json()) as { places?: TextSearchPlace[] };
    return (json.places ?? []).map(placeFromGoogleTextSearch);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${point.lat},${point.lng}`);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("language", "en");
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Google reverse geocode failed: ${res.status}`);
    const json = (await res.json()) as { status: string; results: GeocodeResult[] };
    const first = json.results?.[0];
    return first ? { ...placeFromGeocodeResult(first), lat: point.lat, lng: point.lng } : null;
  }
}
