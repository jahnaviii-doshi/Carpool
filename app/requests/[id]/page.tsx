import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DriverMatchList } from "@/components/matching/match-lists";
import { MatchesMap } from "@/components/matching/matches-map";
import { RideSummary } from "@/components/rides/ride-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatClock, formatDays, formatWindow } from "@/lib/format";
import { rankMatches } from "@/lib/matching/score";

export default async function RequestDetailPage({
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

  const [college, { data: r }] = await Promise.all([
    getCollegeContext(supabase),
    supabase.from("my_requests").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!r?.window_start || !r.window_end || r.pickup_lat == null || r.dest_lat == null) notFound();
  const tz = college.timeZone;

  const { data: raw, error } = await supabase.rpc("find_matches_for_request", { p_request_id: id });
  const matches = rankMatches(
    (raw ?? []).map((m) => ({
      ...m,
      id: m.offer_id,
      at: m.depart_at,
      detourM: m.detour_m,
      timeGapMin: m.time_gap_minutes,
      ratingAvg: m.driver_rating_avg === null ? null : Number(m.driver_rating_avg),
      ratingCount: m.driver_rating_count,
    })),
  );
  const isSeries = r.recurring_days !== null;

  return (
    <AppShell session={session} title={isSeries ? "Weekly request" : "Your request"} back="/rides">
      {saved ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertDescription>
            {saved === "updated"
              ? "Changes saved."
              : `Posted. Drivers from ${college.shortName} can now see your area and time.`}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <RideSummary
          kind="request"
          from={r.pickup_label ?? ""}
          to={r.dest_label ?? ""}
          when={
            isSeries
              ? `${formatDays(r.recurring_days)}, ${formatClock(r.window_start, tz)}–${formatClock(r.window_end, tz)}`
              : formatWindow(r.window_start, r.window_end, tz)
          }
          seats={`${r.seats_needed} seat${r.seats_needed === 1 ? "" : "s"}`}
          badges={isSeries ? ["Repeats"] : []}
        />
        {r.status === "open" ? (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href={`/requests/${r.id}/edit`}>Edit request</Link>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm capitalize">{r.status}</p>
        )}
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="matches-heading">
        <h2 id="matches-heading" className="text-lg font-semibold">
          {matches.length > 0
            ? `${matches.length} driver${matches.length === 1 ? "" : "s"} going your way`
            : "Drivers going your way"}
        </h2>
        <MatchesMap
          mine={{
            start: { lat: r.pickup_lat, lng: r.pickup_lng! },
            end: { lat: r.dest_lat, lng: r.dest_lng! },
          }}
          others={matches.map((m) => ({
            id: m.offer_id,
            lat: m.origin_lat,
            lng: m.origin_lng,
            title: `${m.driver_first_name} · ${formatClock(m.depart_at, tz)}`,
          }))}
        />
        {error ? (
          <p className="text-destructive">Could not load matches. Please refresh.</p>
        ) : (
          <DriverMatchList matches={matches} timeZone={tz} />
        )}
      </section>
    </AppShell>
  );
}
