import "server-only";

import { serverEnv } from "@/lib/env.server";
import { FixtureGeocoder } from "@/lib/geo/fixture";
import { GoogleGeocoder } from "@/lib/geo/google";
import { NominatimGeocoder } from "@/lib/geo/nominatim";
import { OlaGeocoder } from "@/lib/geo/ola";
import { OrsRouter, OsrmRouter, StraightLineRouter } from "@/lib/geo/routers";
import type { Geocoder, LatLng, Place, Router, SearchOptions } from "@/lib/geo/types";

/**
 * Wraps a geocoder with a small in-memory cache and a minimum gap between
 * upstream calls (Nominatim's public server allows 1 request per second).
 * The cache is per server instance, which is enough to absorb repeated
 * keystrokes and popular places; a shared cache can replace it later.
 */
export class CachedThrottledGeocoder implements Geocoder {
  readonly name: string;
  private cache = new Map<string, { at: number; value: unknown }>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(
    private readonly inner: Geocoder,
    private readonly minGapMs: number,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
    private readonly maxEntries = 2000,
  ) {
    this.name = inner.name;
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value as T;

    const run = this.queue.then(async () => {
      const wait = this.lastCall + this.minGapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      return load();
    });
    this.queue = run.catch(() => undefined);
    const value = await run;

    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  search(query: string, options: SearchOptions = {}): Promise<Place[]> {
    const key = `s|${query.trim().toLowerCase()}|${JSON.stringify(options)}`;
    return this.cached(key, () => this.inner.search(query, options));
  }

  reverse(point: LatLng): Promise<Place | null> {
    // ~10 m precision is plenty and makes the cache useful.
    const key = `r|${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
    return this.cached(key, () => this.inner.reverse(point));
  }
}

let geocoder: Geocoder | undefined;
let router: Router | undefined;

export function getGeocoder(): Geocoder {
  if (geocoder) return geocoder;
  const env = serverEnv();
  switch (env.GEOCODER_PROVIDER) {
    case "fixture":
      geocoder = new FixtureGeocoder();
      break;
    case "google":
      if (!env.GOOGLE_MAPS_API_KEY) throw new Error("GOOGLE_MAPS_API_KEY is not set");
      geocoder = new CachedThrottledGeocoder(new GoogleGeocoder(env.GOOGLE_MAPS_API_KEY), 0);
      break;
    case "ola":
      if (!env.OLA_MAPS_API_KEY) throw new Error("OLA_MAPS_API_KEY is not set");
      geocoder = new CachedThrottledGeocoder(new OlaGeocoder(env.OLA_MAPS_API_KEY), 0);
      break;
    default: {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      geocoder = new CachedThrottledGeocoder(
        new NominatimGeocoder(env.NOMINATIM_BASE_URL, `CampusPool/0.1 (+${site})`),
        1100,
      );
    }
  }
  return geocoder;
}

export function getRouter(): Router {
  if (router) return router;
  const env = serverEnv();
  if (env.ROUTER_PROVIDER === "osrm" && env.OSRM_BASE_URL) {
    router = new OsrmRouter(env.OSRM_BASE_URL);
  } else if (env.ROUTER_PROVIDER === "ors" && env.ORS_API_KEY) {
    router = new OrsRouter(env.ORS_API_KEY);
  } else {
    router = new StraightLineRouter();
  }
  return router;
}
