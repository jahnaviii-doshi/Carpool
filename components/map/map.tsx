"use client";

import dynamic from "next/dynamic";

import type { LeafletMapProps } from "@/components/map/leaflet-map";

/** Leaflet touches `window`, so it is only loaded in the browser. */
export const MapView = dynamic<LeafletMapProps>(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted text-muted-foreground flex h-64 w-full items-center justify-center rounded-lg text-sm">
      Loading map…
    </div>
  ),
});
