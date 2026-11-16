/**
 * Region / locale defaults. The spec was written for India (IST, INR, +91,
 * 112); the first seeded college is the American University of Sharjah, so
 * the defaults are UAE. Everything locale-specific reads from here so a
 * future per-college override is a one-place change.
 */
export interface RegionConfig {
  /** IANA zone used to display times. Storage is always UTC (timestamptz). */
  timeZone: string;
  /** BCP-47 locale for number/date formatting. */
  locale: string;
  /** ISO 4217 currency for the cost-sharing field. */
  currency: string;
  /** Default ISO 3166 country for phone parsing (E.164). */
  phoneCountry: string;
  /** Default dialling prefix shown in the phone field. */
  phoneDialCode: string;
  /** Number the SOS button dials. UAE police = 999. */
  emergencyNumber: string;
  /**
   * Whether drivers may enter a cost-per-seat at all. Off by default for the
   * UAE: carrying passengers for payment in a private car is treated as
   * illegal passenger transport there. See README "Cost-sharing".
   */
  costSharingEnabled: boolean;
}

export const UAE: RegionConfig = {
  timeZone: "Asia/Dubai",
  locale: "en-AE",
  currency: "AED",
  phoneCountry: "AE",
  phoneDialCode: "+971",
  emergencyNumber: "999",
  costSharingEnabled: false,
};

export const INDIA: RegionConfig = {
  timeZone: "Asia/Kolkata",
  locale: "en-IN",
  currency: "INR",
  phoneCountry: "IN",
  phoneDialCode: "+91",
  emergencyNumber: "112",
  costSharingEnabled: true,
};

const REGIONS = { AE: UAE, IN: INDIA } as const;
export type RegionCode = keyof typeof REGIONS;

export function isRegionCode(value: string | undefined): value is RegionCode {
  return value !== undefined && value in REGIONS;
}

export function getRegion(code: string | undefined = process.env.NEXT_PUBLIC_REGION): RegionConfig {
  return isRegionCode(code) ? REGIONS[code] : UAE;
}
