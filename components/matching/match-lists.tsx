import { ArrowRight, Bike, Car, Clock, MapPin, Users } from "lucide-react";

import { Rating } from "@/components/matching/rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approxDistanceLabel } from "@/lib/geo/distance";
import { formatRideTime, formatWindow } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

/** Rows returned by the matching RPCs (generated from the database). */
export type DriverMatch =
  Database["public"]["Functions"]["find_matches_for_request"]["Returns"][number];
export type RiderMatch =
  Database["public"]["Functions"]["find_matches_for_offer"]["Returns"][number];

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
      <Users className="size-8" aria-hidden />
      {children}
    </div>
  );
}

function timeNote(gap: number) {
  return gap === 0 ? "within your window" : `${gap} min outside your window`;
}

export function DriverMatchList({
  matches,
  timeZone,
}: {
  matches: DriverMatch[];
  timeZone: string;
}) {
  if (matches.length === 0) {
    return (
      <Empty>
        <p>No drivers match yet.</p>
        <p className="text-sm">
          Your request stays visible to drivers from your college, and new rides are matched as
          they&apos;re posted. Try a wider time window to see more.
        </p>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Matching drivers">
      {matches.map((m) => {
        const Icon = m.vehicle_type === "bike" ? Bike : Car;
        return (
          <li
            key={m.offer_id}
            className="flex flex-col gap-3 rounded-lg border p-4"
            data-testid="driver-match"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{m.driver_first_name}</p>
                <Rating avg={m.driver_rating_avg} count={m.driver_rating_count} />
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {m.women_only ? <Badge variant="outline">Women only</Badge> : null}
                {m.is_recurring ? <Badge variant="outline">Regular</Badge> : null}
              </div>
            </div>
            <p className="flex items-center gap-2 text-sm">
              <Icon className="text-muted-foreground size-4" aria-hidden />
              {m.vehicle_color} {m.vehicle_make} {m.vehicle_model}
            </p>
            <p className="flex flex-wrap items-center gap-1 text-sm">
              {m.origin_area ?? "Nearby"}
              <ArrowRight className="text-muted-foreground size-3.5" aria-label="to" />
              {m.dest_area ?? "Nearby"}
            </p>
            <dl className="grid gap-1 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground size-4" aria-hidden />
                <dt className="sr-only">Leaves</dt>
                <dd>
                  {formatRideTime(m.depart_at, timeZone)}
                  {m.flex_minutes ? ` (±${m.flex_minutes} min)` : ""} ·{" "}
                  {timeNote(m.time_gap_minutes)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="text-muted-foreground size-4" aria-hidden />
                <dt className="sr-only">Pickup</dt>
                <dd>Passes {approxDistanceLabel(m.detour_m)} from your pickup</dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground size-4" aria-hidden />
                <dt className="sr-only">Seats</dt>
                <dd>
                  {m.seats_available} seat{m.seats_available === 1 ? "" : "s"} free
                </dd>
              </div>
            </dl>
            {m.notes ? <p className="text-muted-foreground text-sm italic">“{m.notes}”</p> : null}
            <Button disabled variant="secondary" title="Booking arrives in the next update">
              Request a seat (coming soon)
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function RiderMatchList({ matches, timeZone }: { matches: RiderMatch[]; timeZone: string }) {
  if (matches.length === 0) {
    return (
      <Empty>
        <p>No riders match yet.</p>
        <p className="text-sm">
          Riders from your college can see your ride. You&apos;ll find new requests here as
          they&apos;re posted.
        </p>
      </Empty>
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Matching riders">
      {matches.map((m) => (
        <li
          key={m.request_id}
          className="flex flex-col gap-3 rounded-lg border p-4"
          data-testid="rider-match"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{m.rider_first_name}</p>
              <Rating avg={m.rider_rating_avg} count={m.rider_rating_count} />
            </div>
            {m.is_recurring ? <Badge variant="outline">Regular</Badge> : null}
          </div>
          <p className="flex flex-wrap items-center gap-1 text-sm">
            {m.pickup_area ?? "Nearby"}
            <ArrowRight className="text-muted-foreground size-3.5" aria-label="to" />
            {m.dest_area ?? "Nearby"}
          </p>
          <dl className="grid gap-1 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Can leave</dt>
              <dd>
                {formatWindow(m.window_start, m.window_end, timeZone)}
                {m.time_gap_minutes ? ` · ${m.time_gap_minutes} min from your time` : ""}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Pickup</dt>
              <dd>Pickup {approxDistanceLabel(m.detour_m)} off your route</dd>
            </div>
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground size-4" aria-hidden />
              <dt className="sr-only">Seats</dt>
              <dd>
                Needs {m.seats_needed} seat{m.seats_needed === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
          {m.notes ? <p className="text-muted-foreground text-sm italic">“{m.notes}”</p> : null}
          <Button disabled variant="secondary" title="Booking arrives in the next update">
            Offer a seat (coming soon)
          </Button>
        </li>
      ))}
    </ul>
  );
}
