import { OfferForm } from "@/app/offer/offer-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { localDate } from "@/lib/format";
import { loadVehicleOptions } from "@/lib/rides";

export default async function OfferPage() {
  const session = await requireOnboarded();
  const [college, vehicles] = await Promise.all([
    getCollegeContext(session.supabase),
    loadVehicleOptions(session.supabase),
  ]);

  return (
    <AppShell session={session} title="Offer a ride" back="/home">
      <OfferForm
        vehicles={vehicles}
        campus={college.campus}
        campusPlace={college.campusPlace}
        today={localDate(new Date(), college.timeZone)}
        canBeWomenOnly={session.profile.gender === "female"}
        costSharing={{ enabled: college.costSharingEnabled, currency: college.currency }}
      />
    </AppShell>
  );
}
