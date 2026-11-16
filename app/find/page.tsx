import { RequestForm } from "@/app/find/request-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { getCollegeContext } from "@/lib/college";
import { localDate } from "@/lib/format";

export default async function FindPage() {
  const session = await requireOnboarded();
  const college = await getCollegeContext(session.supabase);

  return (
    <AppShell session={session} title="Find a ride" back="/home">
      <p className="text-muted-foreground -mt-2">
        Tell us where and when. Drivers from {college.shortName} see only your area, never your
        exact pickup point, until you both confirm a ride.
      </p>
      <RequestForm
        campus={college.campus}
        campusPlace={college.campusPlace}
        today={localDate(new Date(), college.timeZone)}
        canBeWomenOnly={session.profile.gender === "female"}
      />
    </AppShell>
  );
}
