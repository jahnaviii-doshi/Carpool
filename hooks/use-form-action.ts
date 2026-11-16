"use client";

import { startTransition, useActionState, useState } from "react";
import type { z } from "zod";

import { fieldErrorsFrom, initialFormState, type FormState } from "@/lib/forms";

type ServerAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Runs a form's Zod schema in the browser for instant inline errors, then
 * calls the server action (which validates again with the same schema).
 *
 * The action is started from onSubmit rather than <form action>, so React
 * does not reset the form after a failed submit and the user keeps what
 * they typed.
 */
export function useFormAction(
  serverAction: ServerAction,
  schema?: z.ZodType,
  read: (formData: FormData) => unknown = (fd) => Object.fromEntries(fd.entries()),
) {
  const [state, dispatch, pending] = useActionState(serverAction, initialFormState);
  const [clientErrors, setClientErrors] = useState<FormState["fieldErrors"]>();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (schema) {
      const parsed = schema.safeParse(read(formData));
      if (!parsed.success) {
        setClientErrors(fieldErrorsFrom(parsed.error));
        return;
      }
    }
    setClientErrors(undefined);
    startTransition(() => dispatch(formData));
  }

  return {
    state,
    pending,
    errors: clientErrors ?? state.fieldErrors ?? {},
    onSubmit,
  };
}
