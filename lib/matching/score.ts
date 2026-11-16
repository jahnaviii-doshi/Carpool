/**
 * Pure matching logic: eligibility rules (mirroring the SQL in
 * supabase/migrations/20261116030000_matching.sql) and the ranking score.
 * No I/O, so every edge case is unit-tested in score.test.ts.
 */
import { MATCHING, type MatchingConfig } from "@/lib/matching/config";

const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Eligibility rules
// ---------------------------------------------------------------------------

export type OfferTime = { departAt: Date; flexMinutes: number };
export type RequestWindow = { start: Date; end: Date };

/** Rule 3: departure ± flex overlaps the window. Inclusive at both ends. */
export function timeFits(offer: OfferTime, window: RequestWindow): boolean {
  const earliest = offer.departAt.getTime() - offer.flexMinutes * MINUTE;
  const latest = offer.departAt.getTime() + offer.flexMinutes * MINUTE;
  return earliest <= window.end.getTime() && latest >= window.start.getTime();
}

/** Minutes the driver would need to shift to land inside the window. */
export function timeGapMinutes(departAt: Date, window: RequestWindow): number {
  const t = departAt.getTime();
  if (t >= window.start.getTime() && t <= window.end.getTime()) return 0;
  return Math.round(
    Math.min(Math.abs(t - window.start.getTime()), Math.abs(t - window.end.getTime())) / MINUTE,
  );
}

/** Rule 2: enough free seats (a full ride never matches). */
export function hasSeats(seatsAvailable: number, seatsNeeded: number): boolean {
  return seatsAvailable > 0 && seatsAvailable >= seatsNeeded;
}

/**
 * Rules 4 and 5. `progress` values are positions along the driver's route
 * from 0 (start) to 1 (end), as from ST_LineLocatePoint.
 */
export function routeFits(
  r: {
    pickupDistanceM: number;
    dropoffDistanceM: number;
    dropoffToDriverDestM: number;
    pickupProgress: number;
    dropoffProgress: number;
  },
  config: Pick<MatchingConfig, "pickupRadiusM" | "destRadiusM"> = MATCHING,
): boolean {
  if (r.pickupDistanceM > config.pickupRadiusM) return false;
  if (r.dropoffToDriverDestM <= config.destRadiusM) return true;
  return r.dropoffDistanceM <= config.pickupRadiusM && r.dropoffProgress > r.pickupProgress;
}

/**
 * Recurring rides: a weekly request matches a dated offer when the offer's
 * local weekday is one of the request's days (0 = Sunday). A one-off
 * request (days = null) is compared by date and time only.
 */
export function weekdayFits(offerLocalWeekday: number, requestDays: number[] | null): boolean {
  return requestDays === null || requestDays.includes(offerLocalWeekday);
}

/**
 * Projects a weekly request's local time-of-day window onto a given local
 * date, so it can be compared with a dated offer like a one-off request.
 * `dateUtcMidnight` is the offer's local calendar date at 00:00 UTC and
 * `utcOffsetMin` the zone's offset (UAE: +240, no DST).
 */
export function projectWindow(
  dateUtcMidnight: Date,
  startMinutesOfDay: number,
  endMinutesOfDay: number,
  utcOffsetMin: number,
): RequestWindow {
  const base = dateUtcMidnight.getTime() - utcOffsetMin * MINUTE;
  return {
    start: new Date(base + startMinutesOfDay * MINUTE),
    end: new Date(base + endMinutesOfDay * MINUTE),
  };
}

/** Rule 6: women-only in both directions. */
export function womenOnlyFits(
  offerWomenOnly: boolean,
  riderIsWoman: boolean,
  riderWantsWomenDriver: boolean,
  driverIsWoman: boolean,
): boolean {
  return (!offerWomenOnly || riderIsWoman) && (!riderWantsWomenDriver || driverIsWoman);
}

export type EligibilityInput = {
  sameCollege: boolean;
  blocked: boolean;
  offer: OfferTime & { seatsAvailable: number; womenOnly: boolean; localWeekday: number };
  request: RequestWindow & {
    seatsNeeded: number;
    womenOnlyPref: boolean;
    recurringDays: number[] | null;
  };
  riderIsWoman: boolean;
  driverIsWoman: boolean;
  route: Parameters<typeof routeFits>[0];
};

export type Eligibility = { eligible: boolean; failed: string[] };

/** All hard rules at once, with the names of any that fail. */
export function checkEligibility(
  i: EligibilityInput,
  config: MatchingConfig = MATCHING,
): Eligibility {
  const failed: string[] = [];
  if (!i.sameCollege) failed.push("college");
  if (i.blocked) failed.push("blocked");
  if (!hasSeats(i.offer.seatsAvailable, i.request.seatsNeeded)) failed.push("seats");
  if (!weekdayFits(i.offer.localWeekday, i.request.recurringDays)) failed.push("weekday");
  if (!timeFits(i.offer, i.request)) failed.push("time");
  if (!routeFits(i.route, config)) failed.push("route");
  if (!womenOnlyFits(i.offer.womenOnly, i.riderIsWoman, i.request.womenOnlyPref, i.driverIsWoman)) {
    failed.push("women-only");
  }
  return { eligible: failed.length === 0, failed };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export type ScoreInput = {
  /** Distance from the rider's pickup to the driver's route (rounded). */
  detourM: number;
  /** Minutes the departure lies outside the rider's window (0 = inside). */
  timeGapMin: number;
  ratingAvg: number | null;
  ratingCount: number;
};

/** Rating shrunk towards the prior: (avg·n + prior·k) / (n + k). */
export function adjustedRating(
  avg: number | null,
  count: number,
  config: MatchingConfig = MATCHING,
) {
  const n = avg === null ? 0 : Math.max(0, count);
  const k = config.ratingPriorWeight;
  return ((avg ?? 0) * n + config.ratingPrior * k) / (n + k);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Score in [0, 1]; higher is a better match. */
export function scoreMatch(input: ScoreInput, config: MatchingConfig = MATCHING): number {
  const detour = 1 - clamp01(input.detourM / config.maxDetourM);
  const time = 1 - clamp01(input.timeGapMin / config.maxTimeGapMin);
  const rating = clamp01((adjustedRating(input.ratingAvg, input.ratingCount, config) - 1) / 4);
  const w = config.weights;
  return (w.detour * detour + w.time * time + w.rating * rating) / (w.detour + w.time + w.rating);
}

/**
 * Sorts candidates best-first. Ties go to the earlier ride, then to the id
 * so the order is stable.
 */
export function rankMatches<T extends ScoreInput & { at: string; id: string }>(
  candidates: T[],
  config: MatchingConfig = MATCHING,
): (T & { score: number })[] {
  return candidates
    .map((c) => ({ ...c, score: scoreMatch(c, config) }))
    .sort((a, b) => b.score - a.score || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
