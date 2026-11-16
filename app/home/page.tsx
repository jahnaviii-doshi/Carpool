import { CalendarClock, Car, Search } from "lucide-react";

import { ReverifyBanner } from "@/app/home/reverify-banner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";

export default async function HomePage() {
  const { profile, canWrite, isSuperAdmin } = await requireOnboarded();
  const firstName = profile.full_name?.split(" ")[0];

  return (
    <>
      <AppHeader collegeShortName={profile.college?.short_name} isSuperAdmin={isSuperAdmin} />
      <main className="mx-auto flex max-w-md flex-col gap-6 p-4 pb-12">
        <div className="flex flex-col gap-1 pt-2">
          <h1 className="text-2xl font-bold tracking-tight">Hi {firstName}</h1>
          <p className="text-muted-foreground">{profile.college?.name}</p>
        </div>

        {!canWrite ? <ReverifyBanner banned={profile.is_banned} /> : null}

        {/* Offer / Find arrive in Milestone 3. Disabled rather than hidden so
            the home layout is final. */}
        <div className="grid gap-3">
          <Button size="lg" className="h-20 justify-start text-lg" disabled>
            <Car className="size-6" aria-hidden />
            Offer a ride
          </Button>
          <Button size="lg" variant="outline" className="h-20 justify-start text-lg" disabled>
            <Search className="size-6" aria-hidden />
            Find a ride
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Offering and finding rides is coming soon.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">My upcoming rides</h2>
          <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
            <CalendarClock className="size-8" aria-hidden />
            <p>No upcoming rides yet.</p>
          </div>
        </section>
      </main>
    </>
  );
}
