import { haversineM } from "@/lib/geo/distance";
import type { LatLng, Route, Router } from "@/lib/geo/types";

/** Fallback when no routing service is configured: origin → destination. */
export class StraightLineRouter implements Router {
  readonly name = "straight-line";

  async route(from: LatLng, to: LatLng): Promise<Route> {
    return {
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
      distanceM: haversineM(from, to),
    };
  }
}

type GeoJsonLine = { type: "LineString"; coordinates: [number, number][] };

/** OSRM (self-hosted or a hosted instance). */
export class OsrmRouter implements Router {
  readonly name = "osrm";

  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async route(from: LatLng, to: LatLng): Promise<Route> {
    const url = new URL(
      `/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
      this.baseUrl,
    );
    url.searchParams.set("overview", "simplified");
    url.searchParams.set("geometries", "geojson");
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`OSRM route failed: ${res.status}`);
    const json = (await res.json()) as {
      code: string;
      routes?: { distance: number; geometry: GeoJsonLine }[];
    };
    const r = json.routes?.[0];
    if (json.code !== "Ok" || !r) throw new Error(`OSRM: no route (${json.code})`);
    return { coordinates: r.geometry.coordinates, distanceM: r.distance };
  }
}

/** OpenRouteService directions. */
export class OrsRouter implements Router {
  readonly name = "ors";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async route(from: LatLng, to: LatLng): Promise<Route> {
    const res = await this.fetchImpl(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: { Authorization: this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      },
    );
    if (!res.ok) throw new Error(`ORS route failed: ${res.status}`);
    const json = (await res.json()) as {
      features?: { geometry: GeoJsonLine; properties: { summary: { distance: number } } }[];
    };
    const f = json.features?.[0];
    if (!f) throw new Error("ORS: no route");
    return { coordinates: f.geometry.coordinates, distanceM: f.properties.summary.distance };
  }
}

/**
 * Tries the configured router and falls back to a straight line, so posting
 * a ride never fails because a routing service is down.
 */
export async function routeOrStraightLine(
  router: Router,
  from: LatLng,
  to: LatLng,
): Promise<Route> {
  if (router.name === "straight-line") return router.route(from, to);
  try {
    return await router.route(from, to);
  } catch {
    return new StraightLineRouter().route(from, to);
  }
}

/** Douglas–Peucker-free thinning: keeps at most `max` evenly spaced points. */
export function thinRoute(coords: [number, number][], max = 500): [number, number][] {
  if (coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)]);
}
