"use client";

import { startReverification } from "@/app/auth/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormAction } from "@/hooks/use-form-action";

export function ReverifyBanner({ banned }: { banned: boolean }) {
  const { state, pending, onSubmit } = useFormAction(startReverification);

  if (banned) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Your account is suspended</AlertTitle>
        <AlertDescription>
          You can still see your past rides, but you can&apos;t post or book. An admin is reviewing
          your account.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <AlertTitle>Confirm you&apos;re still at your college</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          We ask everyone to re-verify their college email every few months. Until you do, you can
          see your rides but can&apos;t post or book.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <FormMessage state={state} />
          <SubmitButton size="sm" pending={pending} pendingText="Sending code…">
            Email me a code
          </SubmitButton>
        </form>
      </AlertDescription>
    </Alert>
  );
}
