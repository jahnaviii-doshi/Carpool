"use client";

import { approveCollege, rejectCollege } from "@/app/admin/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { approveCollegeSchema } from "@/lib/validation/auth";

export type PendingRequest = {
  id: string;
  email: string;
  college_name: string;
  city: string;
  domains: string[];
  website: string | null;
  created_at: string;
};

export function RequestReview({ request }: { request: PendingRequest }) {
  const approve = useFormAction(approveCollege, approveCollegeSchema);
  const reject = useFormAction(rejectCollege);
  const e = approve.errors;

  const fields = [
    { name: "name", label: "Name", defaultValue: request.college_name },
    { name: "shortName", label: "Short name", defaultValue: "" },
    { name: "city", label: "City", defaultValue: request.city },
    { name: "countryCode", label: "Country (2 letters)", defaultValue: "AE" },
    { name: "domains", label: "Email domains", defaultValue: request.domains.join(", ") },
    {
      name: "lat",
      label: "Campus latitude (optional)",
      defaultValue: "",
      inputMode: "decimal" as const,
    },
    {
      name: "lng",
      label: "Campus longitude (optional)",
      defaultValue: "",
      inputMode: "decimal" as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{request.college_name}</CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span>
            {request.city} · requested by {request.email}
          </span>
          <span>Domains: {request.domains.join(", ")}</span>
          {request.website ? (
            <a
              href={request.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-4"
            >
              {request.website}
            </a>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <>
          <p className="text-muted-foreground text-sm">
            Check the domains really belong to this college (e.g. on its website) before approving.
            Anyone with an address at these domains will be able to sign in.
          </p>
          <form onSubmit={approve.onSubmit} noValidate className="grid gap-3">
            <input type="hidden" name="requestId" value={request.id} />
            {fields.map(({ name, label, ...input }) => (
              <div key={name} className="flex flex-col gap-1.5">
                <Label htmlFor={`${request.id}-${name}`}>{label}</Label>
                <Input
                  id={`${request.id}-${name}`}
                  name={name}
                  aria-invalid={e[name] ? true : undefined}
                  aria-describedby={`${request.id}-${name}-error`}
                  {...input}
                />
                <FieldError id={`${request.id}-${name}-error`} errors={e[name]} />
              </div>
            ))}
            <FormMessage state={approve.state} />
            <SubmitButton pending={approve.pending} pendingText="Approving…">
              Approve and add college
            </SubmitButton>
          </form>
          <form onSubmit={reject.onSubmit}>
            <input type="hidden" name="requestId" value={request.id} />
            <FormMessage state={reject.state} />
            <SubmitButton
              variant="outline"
              className="w-full"
              pending={reject.pending}
              pendingText="Rejecting…"
            >
              Reject
            </SubmitButton>
          </form>
        </>
      </CardContent>
    </Card>
  );
}
