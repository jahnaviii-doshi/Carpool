import { CalendarClock, CircleCheck, Plus } from "lucide-react";
import Link from "next/link";

import { cancelRequest } from "@/app/find/actions";
import { cancelOffer } from "@/app/offer/actions";
import { AppShell } from "@/components/app-shell";
import { CancelButton } from "@/components/rides/cancel-button";
import { RideSummary } from "@/components/rides/ride-summary";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatClock, formatDays, formatRideTime, formatWindow } from "@/lib/format";

const SAVED: Record<string, string> = {
  offer: "Your ride is posted. Riders from your college can now see it.",
  request: "Your request is posted. Drivers from your college can now see it.",
};

export default async function RidesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cancelled?: string }>;
}) {
  const session = await requireOnboarded();
  const { supabase } = session;
  const { saved, cancelled } = await searchParams;
  const now = new Date().toISOString();

  const [college, offers, requests, offerSeries, requestSeries] = await Promise.all([
    getCollegeContext(supabase),
    supabase
      .from("my_offers")
      .select("*")
      .is("recurring_days", null)
      .in("status", ["open", "full"])
      .gt("depart_at", now)
      .order("depart_at")
      .limit(50),
    supabase
      .from("my_requests")
      .select("*")
      .is("recurring_days", null)
      .eq("status", "open")
      .gt("window_end", now)
      .order("window_start")
      .limit(50),
    supabase.from("my_offers").select("*").not("recurring_days", "is", null).eq("status", "open"),
    supabase.from("my_requests").select("*").not("recurring_days", "is", null).eq("status", "open"),
  ]);
  const tz = college.timeZone;
  const failed = offers.error || requests.error || offerSeries.error || requestSeries.error;
  const series = [...(offerSeries.data ?? []), ...(requestSeries.data ?? [])];
  const nothing = !offers.data?.length && !requests.data?.length && !series.length;

  return (
    <AppShell session={session} title="My rides">
      {saved && SAVED[saved] ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertDescription>{SAVED[saved]}</AlertDescription>
        </Alert>
      ) : null}
      {cancelled ? (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertDescription>Cancelled.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Button asChild>
          <Link href="/offer">
            <Plus aria-hidden />
            Offer a ride
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/find">
            <Plus aria-hidden />
            Find a ride
          </Link>
        </Button>
      </div>

      {failed ? <p className="text-destructive">Could not load your rides.</p> : null}

      {nothing && !failed ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <CalendarClock className="size-8" aria-hidden />
          <p>Nothing planned yet.</p>
        </div>
      ) : null}

      {offerSeries.data?.length || requestSeries.data?.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="series-heading">
          <h2 id="series-heading" className="text-lg font-semibold">
            Repeating
          </h2>
          <ul className="divide-y rounded-lg border">
            {offerSeries.data?.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 p-3">
                <RideSummary
                  kind="offer"
                  from={o.origin_area ?? o.origin_label ?? ""}
                  to={o.dest_area ?? o.dest_label ?? ""}
                  when={`${formatDays(o.recurring_days)} at ${formatClock(o.depart_at!, tz)} · until ${o.recurring_until}`}
                  seats={`${o.seats_total} seats`}
                  badges={["Repeats", ...(o.women_only ? ["Women only"] : [])]}
                />
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/offers/${o.id}/edit`}>Edit</Link>
                  </Button>
                  <CancelButton
                    id={o.id!}
                    action={cancelOffer}
                    label="Stop repeating"
                    confirmText="Cancel this repeating ride and all its future dates?"
                  />
                </div>
              </li>
            ))}
            {requestSeries.data?.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3">
                <RideSummary
                  kind="request"
                  from={r.pickup_area ?? r.pickup_label ?? ""}
                  to={r.dest_area ?? r.dest_label ?? ""}
                  when={`${formatDays(r.recurring_days)}, ${formatClock(r.window_start!, tz)}–${formatClock(r.window_end!, tz)} · until ${r.recurring_until}`}
                  badges={["Repeats"]}
                />
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/requests/${r.id}/edit`}>Edit</Link>
                  </Button>
                  <CancelButton
                    id={r.id!}
                    action={cancelRequest}
                    label="Stop repeating"
                    confirmText="Cancel this repeating request and all its future dates?"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {offers.data?.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="offers-heading">
          <h2 id="offers-heading" className="text-lg font-semibold">
            Rides I&apos;m offering
          </h2>
          <ul className="divide-y rounded-lg border">
            {offers.data.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 p-3" data-testid="my-offer">
                <RideSummary
                  kind="offer"
                  from={o.origin_area ?? o.origin_label ?? ""}
                  to={o.dest_area ?? o.dest_label ?? ""}
                  when={formatRideTime(o.depart_at!, tz)}
                  seats={`${o.seats_available}/${o.seats_total} free`}
                  badges={[
                    ...(o.series_id ? ["Repeats"] : []),
                    ...(o.women_only ? ["Women only"] : []),
                    ...(o.status === "full" ? ["Full"] : []),
                  ]}
                />
                <p className="text-muted-foreground text-sm">
                  {o.vehicle_color} {o.vehicle_make} {o.vehicle_model} · from {o.origin_label}
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/offers/${o.id}/edit`}>Edit</Link>
                  </Button>
                  <CancelButton
                    id={o.id!}
                    action={cancelOffer}
                    label={o.series_id ? "Cancel this date" : "Cancel"}
                    confirmText="Cancel this ride?"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {requests.data?.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="text-lg font-semibold">
            Rides I need
          </h2>
          <ul className="divide-y rounded-lg border">
            {requests.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-3" data-testid="my-request">
                <RideSummary
                  kind="request"
                  from={r.pickup_area ?? r.pickup_label ?? ""}
                  to={r.dest_area ?? r.dest_label ?? ""}
                  when={formatWindow(r.window_start!, r.window_end!, tz)}
                  seats={`${r.seats_needed} seat${r.seats_needed === 1 ? "" : "s"}`}
                  badges={[
                    ...(r.series_id ? ["Repeats"] : []),
                    ...(r.women_only_pref ? ["Women drivers"] : []),
                  ]}
                />
                <p className="text-muted-foreground text-sm">
                  Matching drivers will appear here soon.
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/requests/${r.id}/edit`}>Edit</Link>
                  </Button>
                  <CancelButton
                    id={r.id!}
                    action={cancelRequest}
                    label={r.series_id ? "Cancel this date" : "Cancel"}
                    confirmText="Cancel this request?"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link href="/vehicles" className="text-muted-foreground text-sm underline underline-offset-4">
        Manage my vehicles
      </Link>
    </AppShell>
  );
}
