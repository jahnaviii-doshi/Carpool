import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RiderMatchList } from "@/components/matching/match-lists";
import { MatchesMap } from "@/components/matching/matches-map";
import { RideSummary } from "@/components/rides/ride-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatClock, formatDays, formatRideTime } from "@/lib/format";
import { rankMatches } from "@/lib/matching/score";

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await requireOnboarded();
  const { supabase } = session;
  const { id } = await params;
  const { saved } = await searchParams;

  const [college, { data: o }] = await Promise.all([
    getCollegeContext(supabase),
    supabase.from("my_offers").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!o?.depart_at || o.origin_lat == null || o.dest_lat == null) notFound();
  const tz = college.timeZone;

  const { data: raw, error } = await supabase.rpc("find_matches_for_offer", { p_offer_id: id });
  const matches = rankMatches(
    (raw ?? []).map((m) => ({
      ...m,
      id: m.request_id,
      at: m.window_start,
      detourM: m.detour_m,
      timeGapMin: m.time_gap_minutes,
      ratingAvg: m.rider_rating_avg === null ? null : Number(m.rider_rating_avg),
      ratingCount: m.rider_rating_count,
    })),
  );
  const isSeries = o.recurring_days !== null;

  return (
    <AppShell session={session} title={isSeries ? "Weekly ride" : "Your ride"} back="/rides">
      {saved ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertDescription>
            {saved === "updated"
              ? "Changes saved."
              : `Posted. Riders from ${college.shortName} can now see your area and time.`}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <RideSummary
          kind="offer"
          from={o.origin_label ?? ""}
          to={o.dest_label ?? ""}
          when={
            isSeries
              ? `${formatDays(o.recurring_days)} at ${formatClock(o.depart_at, tz)}`
              : formatRideTime(o.depart_at, tz)
          }
          seats={isSeries ? `${o.seats_total} seats` : `${o.seats_available}/${o.seats_total} free`}
          badges={[
            ...(isSeries || o.series_id ? ["Repeats"] : []),
            ...(o.women_only ? ["Women only"] : []),
          ]}
        />
        <p className="text-muted-foreground text-sm">
          {o.vehicle_color} {o.vehicle_make} {o.vehicle_model}
        </p>
        {o.status === "open" ? (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href={`/offers/${o.id}/edit`}>Edit ride</Link>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm capitalize">{o.status}</p>
        )}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="matches-heading">
        <h2 id="matches-heading" className="text-lg font-semibold">
          {matches.length > 0
            ? `${matches.length} rider${matches.length === 1 ? "" : "s"} on your way`
            : "Riders on your way"}
        </h2>
        <MatchesMap
          mine={{
            start: { lat: o.origin_lat, lng: o.origin_lng! },
            end: { lat: o.dest_lat, lng: o.dest_lng! },
          }}
          others={matches.map((m) => ({
            id: m.request_id,
            lat: m.pickup_lat,
            lng: m.pickup_lng,
            title: `${m.rider_first_name} · ${formatClock(m.window_start, tz)}`,
          }))}
        />
        {error ? (
          <p className="text-destructive">Could not load matches. Please refresh.</p>
        ) : (
          <RiderMatchList matches={matches} timeZone={tz} />
        )}
      </section>
    </AppShell>
  );
}
