import { notFound } from "next/navigation";

import { RequestForm } from "@/app/find/request-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatClock, localDate } from "@/lib/format";
import { placeFrom } from "@/lib/rides";

export default async function EditRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOnboarded();
  const { id } = await params;
  const [college, { data: r }] = await Promise.all([
    getCollegeContext(session.supabase),
    session.supabase
      .from("my_requests")
      .select("*")
      .eq("id", id)
      .eq("status", "open")
      .maybeSingle(),
  ]);
  if (!r?.window_start || !r.window_end) notFound();
  const tz = college.timeZone;

  return (
    <AppShell session={session} title="Edit request" back="/rides">
      <RequestForm
        campus={college.campus}
        campusPlace={college.campusPlace}
        today={localDate(new Date(), tz)}
        canBeWomenOnly={session.profile.gender === "female"}
        isSeriesDate={r.series_id != null}
        defaults={{
          id: r.id!,
          pickup: placeFrom(r.pickup_lat, r.pickup_lng, r.pickup_label, r.pickup_area),
          dest: placeFrom(r.dest_lat, r.dest_lng, r.dest_label, r.dest_area),
          date: localDate(new Date(r.window_start), tz),
          windowStart: formatClock(r.window_start, tz),
          windowEnd: formatClock(r.window_end, tz),
          seatsNeeded: r.seats_needed ?? 1,
          womenOnlyPref: r.women_only_pref ?? false,
          recurringDays: r.recurring_days,
          recurringUntil: r.recurring_until,
          notes: r.notes,
        }}
      />
    </AppShell>
  );
}
