"use client";

import Link from "next/link";
import { useState } from "react";

import { completeOnboarding } from "@/app/onboarding/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormAction } from "@/hooks/use-form-action";
import { onboardingSchema, readOnboardingForm } from "@/lib/validation/auth";

type Props = {
  dialCode: string;
  defaults: { fullName?: string | null; gender?: string | null; role?: string | null };
};

export function OnboardingForm({ dialCode, defaults }: Props) {
  const { state, pending, errors, onSubmit } = useFormAction(
    completeOnboarding,
    onboardingSchema,
    readOnboardingForm,
  );
  const [drives, setDrives] = useState<"yes" | "no">("no");
  const genderLocked = Boolean(defaults.gender);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          defaultValue={defaults.fullName ?? ""}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby="fullName-help fullName-error"
        />
        <p id="fullName-help" className="text-muted-foreground text-sm">
          Other riders see only your first name until a ride is confirmed.
        </p>
        <FieldError id="fullName-error" errors={errors.fullName} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={`${dialCode} 50 123 4567`}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby="phone-help phone-error"
        />
        <p id="phone-help" className="text-muted-foreground text-sm">
          Shared only with people you have a confirmed ride with.
        </p>
        <FieldError id="phone-error" errors={errors.phone} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">I am</legend>
        <RadioGroup
          name="role"
          defaultValue={defaults.role ?? undefined}
          className="grid grid-cols-2 gap-3"
          aria-invalid={errors.role ? true : undefined}
          aria-describedby="role-error"
        >
          {(["student", "staff"] as const).map((r) => (
            <Label
              key={r}
              htmlFor={`role-${r}`}
              className="has-[[data-state=checked]]:border-primary flex h-12 items-center gap-3 rounded-md border px-3 capitalize"
            >
              <RadioGroupItem id={`role-${r}`} value={r} />
              {r}
            </Label>
          ))}
        </RadioGroup>
        <FieldError id="role-error" errors={errors.role} />
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="yearOrDept">Year or department (optional)</Label>
        <Input
          id="yearOrDept"
          name="yearOrDept"
          placeholder="e.g. Engineering, year 2"
          aria-invalid={errors.yearOrDept ? true : undefined}
          aria-describedby="yearOrDept-error"
        />
        <FieldError id="yearOrDept-error" errors={errors.yearOrDept} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gender">Gender (optional)</Label>
        <Select name="gender" defaultValue={defaults.gender ?? undefined} disabled={genderLocked}>
          <SelectTrigger id="gender" className="h-11 w-full" aria-describedby="gender-help">
            <SelectValue placeholder="Prefer not to say" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="other">Other</SelectItem>
            <SelectItem value="prefer_not">Prefer not to say</SelectItem>
          </SelectContent>
        </Select>
        <p id="gender-help" className="text-muted-foreground text-sm">
          Only used for women-only rides, and never shown to other users. It can be set once; ask an
          admin to change it later.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Do you drive?</legend>
        <RadioGroup
          value={drives}
          onValueChange={(v) => setDrives(v as "yes" | "no")}
          className="grid grid-cols-2 gap-3"
        >
          {(["yes", "no"] as const).map((d) => (
            <Label
              key={d}
              htmlFor={`drives-${d}`}
              className="has-[[data-state=checked]]:border-primary flex h-12 items-center gap-3 rounded-md border px-3 capitalize"
            >
              <RadioGroupItem id={`drives-${d}`} value={d} />
              {d}
            </Label>
          ))}
        </RadioGroup>
        {drives === "yes" ? (
          <p className="text-muted-foreground text-sm">
            Great. You&apos;ll add your vehicle the first time you offer a ride.
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            className="mt-0.5 size-5"
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby="acceptTerms-error"
          />
          <Label htmlFor="acceptTerms" className="leading-snug font-normal">
            <span>
              I accept the{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-4">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                Privacy Policy
              </Link>
              , and I am 18 or older.
            </span>
          </Label>
        </div>
        <FieldError id="acceptTerms-error" errors={errors.acceptTerms} />
      </div>

      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Saving…">
        Finish
      </SubmitButton>
    </form>
  );
}
