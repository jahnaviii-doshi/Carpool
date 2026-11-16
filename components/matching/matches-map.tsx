"use client";

import { MapView } from "@/components/map/map";
import type { MapPin } from "@/components/map/leaflet-map";
import type { LatLng } from "@/lib/geo/types";

/**
 * Your own exact start/end as pins; everyone else only as 400 m circles
 * around their fuzzed point.
 */
export function MatchesMap({
  mine,
  others,
}: {
  mine: { start: LatLng; end: LatLng };
  others: { id: string; lat: number; lng: number; title: string }[];
}) {
  const pins: MapPin[] = [
    { id: "me-start", kind: "start", ...mine.start, title: "Your start" },
    { id: "me-end", kind: "end", ...mine.end, title: "Your destination" },
    ...others.map((o) => ({ ...o, kind: "approx" as const })),
  ];
  const center = {
    lat: (mine.start.lat + mine.end.lat) / 2,
    lng: (mine.start.lng + mine.end.lng) / 2,
  };
  return (
    <div className="flex flex-col gap-1">
      <MapView
        center={center}
        zoom={11}
        pins={pins}
        fitToPins
        line={[
          [mine.start.lat, mine.start.lng],
          [mine.end.lat, mine.end.lng],
        ]}
        ariaLabel="Map of matches. Circles show approximate areas."
      />
      <p className="text-muted-foreground text-xs">
        A and B are your own points. Circles show where others start, give or take 400 m. Exact
        points are shared only after a ride is confirmed.
      </p>
    </div>
  );
}
