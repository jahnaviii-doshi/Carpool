import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

/** Form-level message from a server action, with an optional follow-up link. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  const Icon = state.ok ? CircleCheck : CircleAlert;
  return (
    <Alert variant={state.ok ? "default" : "destructive"} role="status" aria-live="polite">
      <Icon />
      <AlertDescription>
        <p>
          {state.message}{" "}
          {state.link ? (
            <Link href={state.link.href} className="font-semibold underline underline-offset-4">
              {state.link.label}
            </Link>
          ) : null}
        </p>
      </AlertDescription>
    </Alert>
  );
}

/** Inline error under a field. `id` is referenced by the input's aria-describedby. */
export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {errors[0]}
    </p>
  );
}
