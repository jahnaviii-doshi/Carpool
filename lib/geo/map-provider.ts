import type { MapProvider } from "@/lib/geo/types";

/**
 * Tile layer for Leaflet, from NEXT_PUBLIC_* env (safe for the browser).
 * openstreetmap.org tiles are fine for development only; use a hosted tile
 * provider (MapTiler, Stadia, ...) in production.
 */
export function getMapProvider(): MapProvider {
  return {
    tileUrl:
      process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  };
}
