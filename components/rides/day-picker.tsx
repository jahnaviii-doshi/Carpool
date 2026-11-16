import { WEEKDAYS_SHORT } from "@/lib/format";

/** Row of toggle chips that submit `recurringDays` (0 = Sunday … 6 = Saturday). */
export function DayPicker({
  defaultDays = [],
  describedBy,
}: {
  defaultDays?: number[];
  describedBy?: string;
}) {
  return (
    <div
      className="grid grid-cols-7 gap-1"
      role="group"
      aria-label="Repeat on"
      aria-describedby={describedBy}
    >
      {WEEKDAYS_SHORT.map((d, i) => (
        <label key={d} className="relative">
          <input
            type="checkbox"
            name="recurringDays"
            value={i}
            defaultChecked={defaultDays.includes(i)}
            className="peer sr-only"
          />
          <span className="peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary peer-focus-visible:ring-ring/50 flex h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium peer-focus-visible:ring-[3px]">
            {d}
          </span>
        </label>
      ))}
    </div>
  );
}
