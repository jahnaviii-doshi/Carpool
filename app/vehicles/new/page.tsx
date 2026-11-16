import { VehicleForm } from "@/app/vehicles/vehicle-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";
import { safeNext } from "@/lib/college";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireOnboarded();
  const { next } = await searchParams;
  return (
    <AppShell session={session} title="Add a vehicle" back="/vehicles">
      <VehicleForm next={safeNext(next, "/vehicles")} />
    </AppShell>
  );
}
