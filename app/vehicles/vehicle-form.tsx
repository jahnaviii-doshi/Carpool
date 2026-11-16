"use client";

import { useState } from "react";

import { saveVehicle } from "@/app/vehicles/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFormAction } from "@/hooks/use-form-action";
import { readVehicleForm, vehicleSchema } from "@/lib/validation/rides";

export type VehicleDefaults = {
  id?: string;
  type?: "car" | "bike";
  make?: string;
  model?: string;
  color?: string;
  seats?: number;
  plateNumber?: string;
};

export function VehicleForm({
  defaults = {},
  next,
}: {
  defaults?: VehicleDefaults;
  next?: string;
}) {
  const { state, pending, errors, onSubmit } = useFormAction(
    saveVehicle,
    vehicleSchema,
    readVehicleForm,
  );
  const [type, setType] = useState<"car" | "bike">(defaults.type ?? "car");

  const text = (
    name: keyof VehicleDefaults & string,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaults[name] as string | undefined}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={`${name}-error`}
        {...props}
      />
      <FieldError id={`${name}-error`} errors={errors[name]} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <RadioGroup
          name="type"
          value={type}
          onValueChange={(v) => setType(v as "car" | "bike")}
          className="grid grid-cols-2 gap-3"
        >
          {(["car", "bike"] as const).map((t) => (
            <Label
              key={t}
              htmlFor={`type-${t}`}
              className="has-[[data-state=checked]]:border-primary flex h-12 items-center gap-3 rounded-md border px-3 capitalize"
            >
              <RadioGroupItem id={`type-${t}`} value={t} />
              {t}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        {text("make", "Make", { placeholder: "Toyota" })}
        {text("model", "Model", { placeholder: "Corolla" })}
      </div>
      {text("color", "Colour", { placeholder: "White" })}
      {text("seats", "Passenger seats", {
        type: "number",
        inputMode: "numeric",
        min: 1,
        max: type === "bike" ? 1 : 7,
        defaultValue: String(defaults.seats ?? (type === "bike" ? 1 : 3)),
        key: type,
      })}
      {text("plateNumber", "Number plate", {
        placeholder: "SHJ 3 12345",
        autoCapitalize: "characters",
        spellCheck: false,
      })}
      <p className="text-muted-foreground -mt-3 text-sm">
        Your plate is shown only to riders whose seat you accept.
      </p>

      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Saving…">
        Save vehicle
      </SubmitButton>
    </form>
  );
}
