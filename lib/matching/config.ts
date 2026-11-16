/**
 * Every matching knob in one place (spec §6). The hard limits mirror the
 * database defaults in app_settings (match_pickup_radius_m,
 * match_dest_radius_m); the database is authoritative for filtering, this
 * file is authoritative for ranking.
 */
export const MATCHING = {
  /** Pickup must be within this distance of the driver's route. */
  pickupRadiusM: 1500,
  /** Drop-off counts as "same destination" within this distance. */
  destRadiusM: 2000,

  /** Relative importance of each signal in the score (sum to 1). */
  weights: {
    detour: 0.5,
    time: 0.3,
    rating: 0.2,
  },
  /** A detour this long (or longer) scores 0 for the detour signal. */
  maxDetourM: 1500,
  /** A departure this far outside the rider's window scores 0 for time. */
  maxTimeGapMin: 60,

  /** Ratings are shrunk towards this prior so one 5★ doesn't beat fifty 4.8★. */
  ratingPrior: 4,
  /** How many "virtual" ratings the prior is worth. */
  ratingPriorWeight: 3,
} as const;

export type MatchingConfig = {
  pickupRadiusM: number;
  destRadiusM: number;
  weights: { detour: number; time: number; rating: number };
  maxDetourM: number;
  maxTimeGapMin: number;
  ratingPrior: number;
  ratingPriorWeight: number;
};
