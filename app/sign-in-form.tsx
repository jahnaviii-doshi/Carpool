"use client";

import { startSignIn } from "@/app/auth/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { signInSchema } from "@/lib/validation/auth";

export function SignInForm() {
  const { state, pending, errors, onSubmit } = useFormAction(startSignIn, signInSchema);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">College email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@aus.edu"
          required
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" errors={errors.email} />
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" pending={pending} pendingText="Checking…">
        Send me a code
      </SubmitButton>
    </form>
  );
}
