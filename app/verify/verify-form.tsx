"use client";

import { resendCode, verifyCode } from "@/app/auth/actions";
import { FieldError, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/hooks/use-form-action";
import { otpSchema } from "@/lib/validation/auth";

export function VerifyForm() {
  const verify = useFormAction(verifyCode, otpSchema);
  const resend = useFormAction(resendCode);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={verify.onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="token">6-digit code</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            autoFocus
            aria-invalid={verify.errors.token ? true : undefined}
            aria-describedby={verify.errors.token ? "token-error" : undefined}
          />
          <FieldError id="token-error" errors={verify.errors.token} />
        </div>
        <FormMessage state={verify.state} />
        <SubmitButton size="lg" pending={verify.pending} pendingText="Verifying…">
          Verify and continue
        </SubmitButton>
      </form>

      <form onSubmit={resend.onSubmit} className="flex flex-col gap-2">
        <FormMessage state={resend.state} />
        <SubmitButton variant="ghost" pending={resend.pending} pendingText="Sending…">
          Send a new code
        </SubmitButton>
      </form>
    </div>
  );
}
