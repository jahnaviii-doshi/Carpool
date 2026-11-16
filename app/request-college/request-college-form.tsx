"use client";

import { submitCollegeRequest } from "@/app/request-college/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { collegeRequestSchema } from "@/lib/validation/auth";

type Field = { name: string; label: string; help?: string } & React.ComponentProps<typeof Input>;

export function RequestCollegeForm({ email, domain }: { email?: string; domain?: string }) {
  const { state, pending, errors, onSubmit } = useFormAction(
    submitCollegeRequest,
    collegeRequestSchema,
  );

  if (state.ok) return <FormMessage state={state} />;

  const fields: Field[] = [
    {
      name: "email",
      label: "Your college email",
      type: "email",
      defaultValue: email,
      autoComplete: "email",
    },
    { name: "collegeName", label: "College name", placeholder: "e.g. University of Sharjah" },
    { name: "city", label: "City", placeholder: "e.g. Sharjah" },
    {
      name: "domains",
      label: "College email domain(s)",
      defaultValue: domain,
      placeholder: "e.g. university.edu",
      help: "The part after @ in college email addresses. Separate several with commas.",
    },
    { name: "website", label: "College website (optional)", type: "url", placeholder: "https://" },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {fields.map(({ name, label, help, ...input }) => (
        <div key={name} className="flex flex-col gap-2">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            name={name}
            aria-invalid={errors[name] ? true : undefined}
            aria-describedby={`${name}-help ${name}-error`}
            {...input}
          />
          {help ? (
            <p id={`${name}-help`} className="text-muted-foreground text-sm">
              {help}
            </p>
          ) : null}
          <FieldError id={`${name}-error`} errors={errors[name]} />
        </div>
      ))}
      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Sending…">
        Request my college
      </SubmitButton>
    </form>
  );
}
