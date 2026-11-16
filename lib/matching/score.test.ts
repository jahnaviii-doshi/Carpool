import { describe, expect, it } from "vitest";

import { MATCHING, type MatchingConfig } from "./config";
import {
  adjustedRating,
  checkEligibility,
  hasSeats,
  projectWindow,
  rankMatches,
  routeFits,
  scoreMatch,
  timeFits,
  timeGapMinutes,
  weekdayFits,
  womenOnlyFits,
  type EligibilityInput,
} from "./score";

const at = (iso: string) => new Date(iso);
// Offer: 08:00 Dubai = 04:00 UTC, ± 15 min.
const offer = { departAt: at("2026-11-18T04:00:00Z"), flexMinutes: 15 };

describe("timeFits (exact edges are inclusive)", () => {
  it("matches a window containing the departure", () => {
    expect(
      timeFits(offer, { start: at("2026-11-18T03:30:00Z"), end: at("2026-11-18T04:30:00Z") }),
    ).toBe(true);
  });

  it("matches a window that ends exactly at departure − flex", () => {
    expect(
      timeFits(offer, { start: at("2026-11-18T02:45:00Z"), end: at("2026-11-18T03:45:00Z") }),
    ).toBe(true);
  });

  it("does not match a window ending one minute earlier", () => {
    expect(
      timeFits(offer, { start: at("2026-11-18T02:44:00Z"), end: at("2026-11-18T03:44:00Z") }),
    ).toBe(false);
  });

  it("matches a window that starts exactly at departure + flex", () => {
    expect(
      timeFits(offer, { start: at("2026-11-18T04:15:00Z"), end: at("2026-11-18T05:00:00Z") }),
    ).toBe(true);
  });

  it("does not match a window starting one minute later", () => {
    expect(
      timeFits(offer, { start: at("2026-11-18T04:16:00Z"), end: at("2026-11-18T05:00:00Z") }),
    ).toBe(false);
  });

  it("with zero flexibility only the window itself counts", () => {
    const exact = { ...offer, flexMinutes: 0 };
    expect(
      timeFits(exact, { start: at("2026-11-18T04:00:00Z"), end: at("2026-11-18T04:30:00Z") }),
    ).toBe(true);
    expect(
      timeFits(exact, { start: at("2026-11-18T04:01:00Z"), end: at("2026-11-18T04:30:00Z") }),
    ).toBe(false);
  });
});

describe("timeGapMinutes", () => {
  it("is 0 inside the window", () => {
    expect(
      timeGapMinutes(offer.departAt, {
        start: at("2026-11-18T03:30:00Z"),
        end: at("2026-11-18T04:30:00Z"),
      }),
    ).toBe(0);
  });

  it("is the distance to the nearest window edge outside it", () => {
    expect(
      timeGapMinutes(offer.departAt, {
        start: at("2026-11-18T03:00:00Z"),
        end: at("2026-11-18T03:50:00Z"),
      }),
    ).toBe(10);
  });
});

describe("hasSeats", () => {
  it("rejects an offer with 0 seats even for 0 needed", () => {
    expect(hasSeats(0, 0)).toBe(false);
    expect(hasSeats(0, 1)).toBe(false);
  });

  it("needs at least as many seats as requested", () => {
    expect(hasSeats(2, 2)).toBe(true);
    expect(hasSeats(2, 3)).toBe(false);
  });
});

describe("routeFits (direction of travel)", () => {
  const onRoute = {
    pickupDistanceM: 400,
    dropoffDistanceM: 300,
    dropoffToDriverDestM: 5000,
    pickupProgress: 0.3,
    dropoffProgress: 0.7,
  };

  it("accepts a drop-off further along the route", () => {
    expect(routeFits(onRoute)).toBe(true);
  });

  it("rejects the opposite direction (drop-off behind the pickup)", () => {
    expect(routeFits({ ...onRoute, pickupProgress: 0.7, dropoffProgress: 0.3 })).toBe(false);
  });

  it("rejects a full reverse trip (driver's end → driver's start)", () => {
    expect(
      routeFits({
        pickupDistanceM: 100,
        dropoffDistanceM: 100,
        dropoffToDriverDestM: 12_000,
        pickupProgress: 0.95,
        dropoffProgress: 0.02,
      }),
    ).toBe(false);
  });

  it("accepts any on-route pickup going to the driver's destination", () => {
    expect(routeFits({ ...onRoute, dropoffToDriverDestM: 1500, dropoffDistanceM: 3000 })).toBe(
      true,
    );
  });

  it("rejects a pickup just outside the radius", () => {
    expect(routeFits({ ...onRoute, pickupDistanceM: MATCHING.pickupRadiusM + 1 })).toBe(false);
  });

  it("accepts a pickup exactly on the radius", () => {
    expect(routeFits({ ...onRoute, pickupDistanceM: MATCHING.pickupRadiusM })).toBe(true);
  });

  it("rejects a drop-off at the same point as the pickup", () => {
    expect(routeFits({ ...onRoute, dropoffProgress: 0.3 })).toBe(false);
  });
});

describe("recurring vs one-off", () => {
  it("a one-off request accepts any weekday", () => {
    expect(weekdayFits(6, null)).toBe(true);
  });

  it("a weekday request accepts Mon–Fri only", () => {
    const weekdays = [1, 2, 3, 4, 5];
    expect(weekdayFits(3, weekdays)).toBe(true);
    expect(weekdayFits(0, weekdays)).toBe(false);
    expect(weekdayFits(6, weekdays)).toBe(false);
  });

  it("projects a weekly 07:30–08:30 window onto an offer's date in Dubai", () => {
    const w = projectWindow(at("2026-11-18T00:00:00Z"), 7 * 60 + 30, 8 * 60 + 30, 240);
    expect(w.start.toISOString()).toBe("2026-11-18T03:30:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-18T04:30:00.000Z");
    expect(timeFits(offer, w)).toBe(true);
  });

  it("the same weekly window does not fit a 16:00 offer", () => {
    const w = projectWindow(at("2026-11-18T00:00:00Z"), 7 * 60 + 30, 8 * 60 + 30, 240);
    expect(timeFits({ departAt: at("2026-11-18T12:00:00Z"), flexMinutes: 15 }, w)).toBe(false);
  });
});

describe("womenOnlyFits", () => {
  it("women-only offers are only for women riders", () => {
    expect(womenOnlyFits(true, false, false, true)).toBe(false);
    expect(womenOnlyFits(true, true, false, true)).toBe(true);
  });

  it("a rider wanting a woman driver is not matched with a man", () => {
    expect(womenOnlyFits(false, true, true, false)).toBe(false);
    expect(womenOnlyFits(false, true, true, true)).toBe(true);
  });
});

describe("checkEligibility", () => {
  const base: EligibilityInput = {
    sameCollege: true,
    blocked: false,
    offer: { ...offer, seatsAvailable: 2, womenOnly: false, localWeekday: 3 },
    request: {
      start: at("2026-11-18T03:30:00Z"),
      end: at("2026-11-18T04:30:00Z"),
      seatsNeeded: 1,
      womenOnlyPref: false,
      recurringDays: null,
    },
    riderIsWoman: false,
    driverIsWoman: false,
    route: {
      pickupDistanceM: 400,
      dropoffDistanceM: 0,
      dropoffToDriverDestM: 100,
      pickupProgress: 0.4,
      dropoffProgress: 1,
    },
  };

  it("passes a good match", () => {
    expect(checkEligibility(base)).toEqual({ eligible: true, failed: [] });
  });

  it("names every failing rule", () => {
    const r = checkEligibility({
      ...base,
      sameCollege: false,
      blocked: true,
      offer: { ...base.offer, seatsAvailable: 0, localWeekday: 6 },
      request: { ...base.request, recurringDays: [1, 2, 3, 4, 5] },
    });
    expect(r.failed).toEqual(["college", "blocked", "seats", "weekday"]);
  });
});

describe("scoreMatch", () => {
  const perfect = { detourM: 0, timeGapMin: 0, ratingAvg: 5, ratingCount: 100 };

  it("stays within [0, 1]", () => {
    expect(scoreMatch(perfect)).toBeLessThanOrEqual(1);
    expect(
      scoreMatch({ detourM: 99_999, timeGapMin: 999, ratingAvg: 1, ratingCount: 100 }),
    ).toBeGreaterThanOrEqual(0);
  });

  it("prefers a smaller detour", () => {
    expect(scoreMatch({ ...perfect, detourM: 500 })).toBeGreaterThan(
      scoreMatch({ ...perfect, detourM: 1000 }),
    );
  });

  it("prefers a departure inside the window", () => {
    expect(scoreMatch({ ...perfect, timeGapMin: 0 })).toBeGreaterThan(
      scoreMatch({ ...perfect, timeGapMin: 10 }),
    );
  });

  it("does not let one 5★ rating beat many 4.8★ ratings", () => {
    expect(scoreMatch({ ...perfect, ratingAvg: 4.8, ratingCount: 50 })).toBeGreaterThan(
      scoreMatch({ ...perfect, ratingAvg: 5, ratingCount: 1 }),
    );
  });

  it("treats unrated drivers as the prior, not as zero", () => {
    expect(adjustedRating(null, 0)).toBe(MATCHING.ratingPrior);
  });

  it("uses the weights from the config object", () => {
    const timeOnly: MatchingConfig = { ...MATCHING, weights: { detour: 0, time: 1, rating: 0 } };
    expect(
      scoreMatch({ detourM: 1400, timeGapMin: 0, ratingAvg: 1, ratingCount: 50 }, timeOnly),
    ).toBe(1);
  });
});

describe("rankMatches", () => {
  it("sorts best first, breaking ties by earlier time", () => {
    const ranked = rankMatches([
      {
        id: "c",
        at: "2026-11-18T05:00:00Z",
        detourM: 1000,
        timeGapMin: 0,
        ratingAvg: null,
        ratingCount: 0,
      },
      {
        id: "b",
        at: "2026-11-18T04:30:00Z",
        detourM: 0,
        timeGapMin: 0,
        ratingAvg: null,
        ratingCount: 0,
      },
      {
        id: "a",
        at: "2026-11-18T04:00:00Z",
        detourM: 0,
        timeGapMin: 0,
        ratingAvg: null,
        ratingCount: 0,
      },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[2].score);
  });
});
