import { notFound } from "next/navigation";

import { VehicleForm } from "@/app/vehicles/vehicle-form";
import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/auth/session";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOnboarded();
  const { id } = await params;
  const { data: v } = await session.supabase
    .from("vehicles")
    .select("id, type, make, model, color, seats, vehicle_plates(plate_number)")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!v) notFound();

  return (
    <AppShell session={session} title="Edit vehicle" back="/vehicles">
      <VehicleForm
        defaults={{
          id: v.id,
          type: v.type,
          make: v.make,
          model: v.model,
          color: v.color,
          seats: v.seats,
          plateNumber: v.vehicle_plates?.plate_number,
        }}
      />
    </AppShell>
  );
}
