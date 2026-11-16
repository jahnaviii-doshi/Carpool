import { describe, expect, it } from "vitest";

import {
  addDays,
  formatClock,
  formatDays,
  formatRideTime,
  formatWindow,
  localDate,
} from "./format";

const TZ = "Asia/Dubai";

describe("format", () => {
  it("shows UTC times in Dubai time", () => {
    // 04:15 UTC = 08:15 in Dubai (UTC+4, no DST).
    expect(formatClock("2026-11-18T04:15:00Z", TZ)).toBe("08:15");
    expect(formatRideTime("2026-11-18T04:15:00Z", TZ)).toBe("Wed 18 Nov, 08:15");
  });

  it("formats a time window", () => {
    expect(formatWindow("2026-11-18T03:30:00Z", "2026-11-18T04:30:00Z", TZ)).toBe(
      "Wed 18 Nov, 07:30–08:30",
    );
  });

  it("gives the local calendar date in the zone", () => {
    // 21:00 UTC on the 17th is already the 18th in Dubai.
    expect(localDate(new Date("2026-11-17T21:00:00Z"), TZ)).toBe("2026-11-18");
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("summarises repeat days", () => {
    expect(formatDays([5, 1, 2, 3, 4])).toBe("Mon–Fri");
    expect(formatDays([0, 6])).toBe("Sun, Sat");
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(formatDays(null)).toBe("");
  });
});
