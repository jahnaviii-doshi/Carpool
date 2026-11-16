import { notFound } from "next/navigation";

import { OfferForm } from "@/app/offer/offer-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { formatClock, localDate } from "@/lib/format";
import { loadVehicleOptions, placeFrom } from "@/lib/rides";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOnboarded();
  const { id } = await params;
  const [college, vehicles, { data: o }] = await Promise.all([
    getCollegeContext(session.supabase),
    loadVehicleOptions(session.supabase),
    session.supabase.from("my_offers").select("*").eq("id", id).eq("status", "open").maybeSingle(),
  ]);
  if (!o?.depart_at) notFound();
  const tz = college.timeZone;

  return (
    <AppShell session={session} title="Edit ride" back="/rides">
      <OfferForm
        vehicles={vehicles}
        campus={college.campus}
        campusPlace={college.campusPlace}
        today={localDate(new Date(), tz)}
        canBeWomenOnly={session.profile.gender === "female"}
        costSharing={{ enabled: college.costSharingEnabled, currency: college.currency }}
        isSeriesDate={o.series_id != null}
        defaults={{
          id: o.id!,
          vehicleId: o.vehicle_id ?? undefined,
          origin: placeFrom(o.origin_lat, o.origin_lng, o.origin_label, o.origin_area),
          dest: placeFrom(o.dest_lat, o.dest_lng, o.dest_label, o.dest_area),
          date: localDate(new Date(o.depart_at), tz),
          time: formatClock(o.depart_at, tz),
          flexMinutes: o.flex_minutes ?? 15,
          seats: o.seats_total ?? 1,
          recurringDays: o.recurring_days,
          recurringUntil: o.recurring_until,
          costPerSeat: o.cost_per_seat,
          womenOnly: o.women_only ?? false,
          notes: o.notes,
        }}
      />
    </AppShell>
  );
}
