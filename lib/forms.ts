import { z } from "zod";

/** Result returned by every form server action (used with useActionState). */
export type FormState = {
  /** Message shown above the form (errors from the server or database). */
  message?: string;
  /** Inline errors keyed by field name. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** Set when the action succeeded but stayed on the page. */
  ok?: boolean;
  /** Optional link shown with the message, e.g. "Request your college". */
  link?: { href: string; label: string };
};

export const initialFormState: FormState = {};

export function fieldErrorsFrom(error: z.ZodError): FormState["fieldErrors"] {
  return z.flattenError(error).fieldErrors as FormState["fieldErrors"];
}

/** Reads a FormData object into a plain object of strings / booleans. */
export function formToObject(formData: FormData): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
