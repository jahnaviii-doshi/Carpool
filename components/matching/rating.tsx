import { Star } from "lucide-react";

export function Rating({ avg, count }: { avg: number | null; count: number }) {
  if (avg === null || count === 0) {
    return <span className="text-muted-foreground text-sm">New</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-sm"
      aria-label={`Rated ${avg} out of 5 by ${count} people`}
    >
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {Number(avg).toFixed(1)}
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}
