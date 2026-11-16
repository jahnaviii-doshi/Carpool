"use client";

import Link from "next/link";
import { useState } from "react";

import { saveOffer } from "@/app/offer/actions";
import { FormMessage } from "@/components/form-message";
import { PlacePicker } from "@/components/map/place-picker";
import { DayPicker } from "@/components/rides/day-picker";
import { Field, fieldAria } from "@/components/rides/field";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { addDays } from "@/lib/format";
import type { LatLng, Place } from "@/lib/geo/types";
import { offerSchema, readOfferForm } from "@/lib/validation/rides";

export type VehicleOption = { id: string; label: string; seats: number };

export type OfferDefaults = {
  id?: string;
  vehicleId?: string;
  origin?: Place | null;
  dest?: Place | null;
  date?: string;
  time?: string;
  flexMinutes?: number;
  seats?: number;
  recurringDays?: number[] | null;
  recurringUntil?: string | null;
  costPerSeat?: number | null;
  womenOnly?: boolean;
  notes?: string | null;
};

type Props = {
  vehicles: VehicleOption[];
  campus: LatLng | null;
  campusPlace: Place | null;
  today: string;
  canBeWomenOnly: boolean;
  costSharing: { enabled: boolean; currency: string };
  defaults?: OfferDefaults;
  /** Editing one date of a series: repeat settings are fixed. */
  isSeriesDate?: boolean;
};

const FLEX_OPTIONS = [0, 5, 10, 15, 30, 45, 60];

export function OfferForm({
  vehicles,
  campus,
  campusPlace,
  today,
  canBeWomenOnly,
  costSharing,
  defaults = {},
  isSeriesDate = false,
}: Props) {
  const { state, pending, errors, onSubmit } = useFormAction(saveOffer, offerSchema, readOfferForm);
  const [vehicleId, setVehicleId] = useState(defaults.vehicleId ?? vehicles[0]?.id ?? "");
  const [repeat, setRepeat] = useState(Boolean(defaults.recurringDays?.length));
  const [date, setDate] = useState(defaults.date ?? addDays(today, 1));
  const maxSeats = vehicles.find((v) => v.id === vehicleId)?.seats ?? 7;
  const isEdit = Boolean(defaults.id);

  if (vehicles.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
        <p>Add your vehicle first. Riders see its make, model and colour.</p>
        <Link
          href="/vehicles/new?next=/offer"
          className="font-semibold underline underline-offset-4"
        >
          Add a vehicle →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <PlacePicker
        name="origin"
        label="Leaving from"
        campus={campus}
        defaultPlace={defaults.origin}
        shortcut={campusPlace}
        errors={errors.origin}
      />
      <PlacePicker
        name="dest"
        label="Going to"
        campus={campus}
        defaultPlace={defaults.dest === undefined ? campusPlace : defaults.dest}
        shortcut={campusPlace}
        errors={errors.dest}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field id="date" label={repeat ? "First date" : "Date"} errors={errors.date}>
          <Input
            type="date"
            min={today}
            max={addDays(today, 60)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            {...fieldAria("date", errors.date)}
          />
        </Field>
        <Field id="time" label="Leaving at" errors={errors.time}>
          <Input
            type="time"
            defaultValue={defaults.time ?? "08:00"}
            {...fieldAria("time", errors.time)}
          />
        </Field>
      </div>

      <Field
        id="flexMinutes"
        label="Flexibility"
        errors={errors.flexMinutes}
        help="How much earlier or later you could leave."
      >
        <Select name="flexMinutes" defaultValue={String(defaults.flexMinutes ?? 15)}>
          <SelectTrigger
            id="flexMinutes"
            className="h-11 w-full"
            aria-describedby="flexMinutes-help"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLEX_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m === 0 ? "Exact time" : `± ${m} min`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <Field id="vehicleId" label="Vehicle" errors={errors.vehicleId}>
          <Select name="vehicleId" value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger
              id="vehicleId"
              className="h-11 w-full"
              aria-invalid={errors.vehicleId ? true : undefined}
            >
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="seats" label="Seats" errors={errors.seats}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxSeats}
            defaultValue={defaults.seats ?? Math.min(3, maxSeats)}
            className="w-20"
            {...fieldAria("seats", errors.seats)}
          />
        </Field>
      </div>
      <Link
        href="/vehicles/new?next=/offer"
        className="text-muted-foreground -mt-4 text-sm underline underline-offset-4"
      >
        Add another vehicle
      </Link>

      {!isSeriesDate && (!isEdit || repeat) ? (
        <div className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="repeat"
              name="repeat"
              checked={repeat}
              onCheckedChange={(c) => setRepeat(c === true)}
              disabled={isEdit}
              className="size-5"
            />
            <Label htmlFor="repeat">Repeat every week (daily commute)</Label>
          </div>
          {repeat ? (
            <>
              {isEdit ? <input type="hidden" name="repeat" value="on" /> : null}
              <DayPicker
                defaultDays={defaults.recurringDays ?? [1, 2, 3, 4, 5]}
                describedBy="recurringDays-error"
              />
              <p id="recurringDays-error" className="text-destructive text-sm empty:hidden">
                {errors.recurringDays?.[0]}
              </p>
              <Field id="recurringUntil" label="Until" errors={errors.recurringUntil}>
                <Input
                  type="date"
                  min={date}
                  max={addDays(date, 120)}
                  defaultValue={defaults.recurringUntil ?? addDays(date, 16 * 7)}
                  {...fieldAria("recurringUntil", errors.recurringUntil)}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}

      {costSharing.enabled ? (
        <Field
          id="costPerSeat"
          label={`Fuel share per seat (${costSharing.currency}, optional)`}
          errors={errors.costPerSeat}
          help="Cost-sharing only — no profit rides. Riders pay you directly."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults.costPerSeat ?? ""}
            {...fieldAria("costPerSeat", errors.costPerSeat, true)}
          />
        </Field>
      ) : (
        <p className="text-muted-foreground rounded-md border p-3 text-sm">
          Rides on CampusPool are free. Please don&apos;t ask riders for money.
        </p>
      )}

      {canBeWomenOnly ? (
        <div className="flex items-center gap-3">
          <Checkbox
            id="womenOnly"
            name="womenOnly"
            defaultChecked={defaults.womenOnly}
            className="size-5"
          />
          <Label htmlFor="womenOnly">Women riders only</Label>
        </div>
      ) : null}

      <Field
        id="notes"
        label="Notes (optional)"
        errors={errors.notes}
        help="e.g. where exactly you'll wait, luggage space."
      >
        <Textarea
          maxLength={500}
          rows={3}
          defaultValue={defaults.notes ?? ""}
          {...fieldAria("notes", errors.notes, true)}
        />
      </Field>

      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Saving…">
        {isEdit ? "Save changes" : "Offer this ride"}
      </SubmitButton>
    </form>
  );
}
