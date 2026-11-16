import { Bike, Car, Plus } from "lucide-react";
import Link from "next/link";

import { RemoveVehicleButton } from "@/app/vehicles/remove-vehicle-button";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireOnboarded } from "@/lib/auth/session";

export default async function VehiclesPage() {
  const session = await requireOnboarded();
  const { data: vehicles, error } = await session.supabase
    .from("vehicles")
    .select("id, type, make, model, color, seats, vehicle_plates(plate_number)")
    .eq("is_active", true)
    .order("created_at");

  return (
    <AppShell session={session} title="My vehicles">
      {error ? (
        <p className="text-destructive">Could not load your vehicles.</p>
      ) : vehicles.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <Car className="size-8" aria-hidden />
          <p>No vehicles yet. Add one to offer rides.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {vehicles.map((v) => {
            const Icon = v.type === "bike" ? Bike : Car;
            const name = `${v.color} ${v.make} ${v.model}`;
            return (
              <li key={v.id} className="flex items-center gap-3 p-3">
                <Icon className="text-muted-foreground size-6 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{name}</p>
                  <p className="text-muted-foreground text-sm">
                    {v.vehicle_plates?.plate_number} · {v.seats} seat{v.seats === 1 ? "" : "s"}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/vehicles/${v.id}`}>Edit</Link>
                </Button>
                <RemoveVehicleButton id={v.id} name={name} />
              </li>
            );
          })}
        </ul>
      )}
      <Button asChild size="lg">
        <Link href="/vehicles/new">
          <Plus aria-hidden />
          Add a vehicle
        </Link>
      </Button>
    </AppShell>
  );
}
