import { ArrowRight, Repeat, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** "Al Nahda → AUS campus" with time and small badges. Shared by lists. */
export function RideSummary({
  from,
  to,
  when,
  kind,
  seats,
  badges = [],
}: {
  from: string;
  to: string;
  when: string;
  kind: "offer" | "request";
  seats?: string;
  badges?: string[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={kind === "offer" ? "default" : "secondary"}>
          {kind === "offer" ? "Driving" : "Riding"}
        </Badge>
        {badges.map((b) => (
          <Badge key={b} variant="outline">
            {b.startsWith("Repeats") ? <Repeat aria-hidden /> : null}
            {b}
          </Badge>
        ))}
      </div>
      <p className="flex flex-wrap items-center gap-1 font-medium">
        <span className="break-words">{from}</span>
        <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-label="to" />
        <span className="break-words">{to}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        {when}
        {seats ? (
          <>
            {" · "}
            <Users className="inline size-3.5 align-[-2px]" aria-hidden /> {seats}
          </>
        ) : null}
      </p>
    </div>
  );
}
