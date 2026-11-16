import { CalendarClock, Car, Search } from "lucide-react";
import Link from "next/link";

import { ReverifyBanner } from "@/app/home/reverify-banner";
import { AppShell } from "@/components/app-shell";
import { RideSummary } from "@/components/rides/ride-summary";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatRideTime, formatWindow } from "@/lib/format";

export default async function HomePage() {
  const session = await requireOnboarded();
  const { profile, canWrite, supabase } = session;
  const firstName = profile.full_name?.split(" ")[0];
  const now = new Date().toISOString();

  const [college, offers, requests] = await Promise.all([
    getCollegeContext(supabase),
    supabase
      .from("my_offers")
      .select(
        "id, origin_area, origin_label, dest_area, dest_label, depart_at, seats_available, seats_total",
      )
      .is("recurring_days", null)
      .in("status", ["open", "full"])
      .gt("depart_at", now)
      .order("depart_at")
      .limit(3),
    supabase
      .from("my_requests")
      .select("id, pickup_area, pickup_label, dest_area, dest_label, window_start, window_end")
      .is("recurring_days", null)
      .eq("status", "open")
      .gt("window_end", now)
      .order("window_start")
      .limit(3),
  ]);

  const upcoming = [
    ...(offers.data ?? []).map((o) => ({
      key: `o-${o.id}`,
      at: o.depart_at!,
      node: (
        <RideSummary
          kind="offer"
          from={o.origin_area ?? o.origin_label ?? ""}
          to={o.dest_area ?? o.dest_label ?? ""}
          when={formatRideTime(o.depart_at!, college.timeZone)}
          seats={`${o.seats_available}/${o.seats_total} free`}
        />
      ),
    })),
    ...(requests.data ?? []).map((r) => ({
      key: `r-${r.id}`,
      at: r.window_start!,
      node: (
        <RideSummary
          kind="request"
          from={r.pickup_area ?? r.pickup_label ?? ""}
          to={r.dest_area ?? r.dest_label ?? ""}
          when={formatWindow(r.window_start!, r.window_end!, college.timeZone)}
        />
      ),
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 3);

  return (
    <AppShell session={session}>
      <div className="flex flex-col gap-1 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Hi {firstName}</h1>
        <p className="text-muted-foreground">{profile.college?.name}</p>
      </div>

      {!canWrite ? <ReverifyBanner banned={profile.is_banned} /> : null}

      <div className="grid gap-3">
        <Button
          asChild={canWrite}
          size="lg"
          className="h-20 justify-start text-lg"
          disabled={!canWrite}
        >
          {canWrite ? (
            <Link href="/offer">
              <Car className="size-6" aria-hidden />
              Offer a ride
            </Link>
          ) : (
            <span>
              <Car className="size-6" aria-hidden />
              Offer a ride
            </span>
          )}
        </Button>
        <Button
          asChild={canWrite}
          size="lg"
          variant="outline"
          className="h-20 justify-start text-lg"
          disabled={!canWrite}
        >
          {canWrite ? (
            <Link href="/find">
              <Search className="size-6" aria-hidden />
              Find a ride
            </Link>
          ) : (
            <span>
              <Search className="size-6" aria-hidden />
              Find a ride
            </span>
          )}
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">My upcoming rides</h2>
          <Link href="/rides" className="text-sm underline underline-offset-4">
            See all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <CalendarClock className="size-8" aria-hidden />
            <p>No upcoming rides yet.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {upcoming.map((u) => (
              <li key={u.key} className="p-3">
                {u.node}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
