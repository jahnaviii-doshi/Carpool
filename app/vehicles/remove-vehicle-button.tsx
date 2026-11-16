"use client";

import { removeVehicle } from "@/app/vehicles/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/hooks/use-form-action";

export function RemoveVehicleButton({ id, name }: { id: string; name: string }) {
  const { state, pending, onSubmit } = useFormAction(removeVehicle);
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${name}?`)) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="sm" pending={pending} pendingText="Removing…">
        Remove
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
