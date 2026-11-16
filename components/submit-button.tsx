import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string };

/** Submit button that disables itself and shows a spinner while pending. */
export function SubmitButton({ children, pending, pendingText, disabled, ...props }: Props) {
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
