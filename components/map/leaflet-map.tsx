"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { getMapProvider } from "@/lib/geo/map-provider";
import type { LatLng } from "@/lib/geo/types";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: "start" | "end" | "campus" | "approx";
  title?: string;
};

export type LeafletMapProps = {
  center: LatLng;
  zoom?: number;
  pins?: MapPin[];
  /** Polyline in [lat, lng] order. */
  line?: [number, number][];
  /** Called when the user taps the map. */
  onPick?: (point: LatLng) => void;
  /** Re-centre when this point changes. */
  focus?: LatLng | null;
  className?: string;
  ariaLabel?: string;
};

const PIN_STYLE: Record<MapPin["kind"], string> = {
  start: "bg-primary text-primary-foreground",
  end: "bg-foreground text-background",
  campus: "bg-amber-500 text-black",
  approx: "bg-primary/80 text-primary-foreground",
};
const PIN_TEXT: Record<MapPin["kind"], string> = { start: "A", end: "B", campus: "★", approx: "~" };

function pinIcon(kind: MapPin["kind"]) {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="${PIN_STYLE[kind]} flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold shadow-md">${PIN_TEXT[kind]}</div>`,
  });
}

function TapHandler({ onPick }: { onPick?: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function FocusOn({ focus }: { focus?: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 14));
  }, [focus, map]);
  return null;
}

/**
 * Thin wrapper around react-leaflet. Approximate (fuzzed) points are drawn as
 * a 400 m circle so it is obvious they are not exact.
 */
export default function LeafletMap({
  center,
  zoom = 12,
  pins = [],
  line,
  onPick,
  focus,
  className,
  ariaLabel = "Map",
}: LeafletMapProps) {
  const provider = getMapProvider();
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      className={className ?? "h-64 w-full rounded-lg"}
      scrollWheelZoom={false}
      aria-label={ariaLabel}
    >
      <TileLayer
        url={provider.tileUrl}
        attribution={provider.attribution}
        maxZoom={provider.maxZoom}
      />
      <TapHandler onPick={onPick} />
      <FocusOn focus={focus} />
      {line && line.length > 1 ? (
        <Polyline positions={line} pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.8 }} />
      ) : null}
      {pins.map((p) =>
        p.kind === "approx" ? (
          <Circle
            key={p.id}
            center={[p.lat, p.lng]}
            radius={400}
            pathOptions={{ color: "#0f766e", fillOpacity: 0.15, weight: 1 }}
          />
        ) : (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.kind)} title={p.title} />
        ),
      )}
    </MapContainer>
  );
}
