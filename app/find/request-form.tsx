"use client";

import { useState } from "react";

import { saveRequest } from "@/app/find/actions";
import { FormMessage } from "@/components/form-message";
import { PlacePicker } from "@/components/map/place-picker";
import { DayPicker } from "@/components/rides/day-picker";
import { Field, fieldAria } from "@/components/rides/field";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";
import { addDays } from "@/lib/format";
import type { LatLng, Place } from "@/lib/geo/types";
import { readRequestForm, requestSchema } from "@/lib/validation/rides";

export type RequestDefaults = {
  id?: string;
  pickup?: Place | null;
  dest?: Place | null;
  date?: string;
  windowStart?: string;
  windowEnd?: string;
  seatsNeeded?: number;
  womenOnlyPref?: boolean;
  recurringDays?: number[] | null;
  recurringUntil?: string | null;
  notes?: string | null;
};

type Props = {
  campus: LatLng | null;
  campusPlace: Place | null;
  today: string;
  canBeWomenOnly: boolean;
  defaults?: RequestDefaults;
  isSeriesDate?: boolean;
};

export function RequestForm({
  campus,
  campusPlace,
  today,
  canBeWomenOnly,
  defaults = {},
  isSeriesDate = false,
}: Props) {
  const { state, pending, errors, onSubmit } = useFormAction(
    saveRequest,
    requestSchema,
    readRequestForm,
  );
  const [repeat, setRepeat] = useState(Boolean(defaults.recurringDays?.length));
  const [date, setDate] = useState(defaults.date ?? addDays(today, 1));
  const isEdit = Boolean(defaults.id);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <PlacePicker
        name="pickup"
        label="Pick me up at"
        campus={campus}
        defaultPlace={defaults.pickup}
        shortcut={campusPlace}
        errors={errors.pickup}
      />
      <PlacePicker
        name="dest"
        label="Going to"
        campus={campus}
        defaultPlace={defaults.dest === undefined ? campusPlace : defaults.dest}
        shortcut={campusPlace}
        errors={errors.dest}
      />

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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">I can leave between</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="windowStart" label="Earliest" errors={errors.windowStart}>
            <Input
              type="time"
              defaultValue={defaults.windowStart ?? "07:30"}
              {...fieldAria("windowStart", errors.windowStart)}
            />
          </Field>
          <Field id="windowEnd" label="Latest" errors={errors.windowEnd}>
            <Input
              type="time"
              defaultValue={defaults.windowEnd ?? "08:30"}
              {...fieldAria("windowEnd", errors.windowEnd)}
            />
          </Field>
        </div>
      </fieldset>

      <Field id="seatsNeeded" label="Seats needed" errors={errors.seatsNeeded}>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={6}
          defaultValue={defaults.seatsNeeded ?? 1}
          className="w-24"
          {...fieldAria("seatsNeeded", errors.seatsNeeded)}
        />
      </Field>

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
            <Label htmlFor="repeat">I need this every week</Label>
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

      {canBeWomenOnly ? (
        <div className="flex items-center gap-3">
          <Checkbox
            id="womenOnlyPref"
            name="womenOnlyPref"
            defaultChecked={defaults.womenOnlyPref}
            className="size-5"
          />
          <Label htmlFor="womenOnlyPref">Only match me with women drivers</Label>
        </div>
      ) : null}

      <Field id="notes" label="Notes (optional)" errors={errors.notes}>
        <Textarea
          maxLength={500}
          rows={3}
          defaultValue={defaults.notes ?? ""}
          {...fieldAria("notes", errors.notes)}
        />
      </Field>

      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Saving…">
        {isEdit ? "Save changes" : "Post my request"}
      </SubmitButton>
    </form>
  );
}
