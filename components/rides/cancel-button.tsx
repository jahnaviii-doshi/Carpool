"use client";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/hooks/use-form-action";
import type { FormState } from "@/lib/forms";

/** Small confirm-then-submit form used for cancelling offers and requests. */
export function CancelButton({
  id,
  action,
  confirmText,
  label = "Cancel",
}: {
  id: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  confirmText: string;
  label?: string;
}) {
  const { state, pending, onSubmit } = useFormAction(action);
  return (
    <form
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" size="sm" pending={pending} pendingText="Cancelling…">
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
