import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

import { getRegion } from "@/lib/config/region";

/** Normalised (trimmed, lower-cased) email address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254));

export const signInSchema = z.object({ email: emailSchema });

export const otpSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Enter the 6-digit code from your email." }),
});

/**
 * Parses a phone number typed by the user into E.164. Numbers without a
 * country prefix are read as the region default (UAE: +971).
 */
export function toE164(
  input: string,
  country: CountryCode = getRegion().phoneCountry as CountryCode,
) {
  const parsed = parsePhoneNumberFromString(input.trim(), country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your phone number." })
  .transform((value, ctx) => {
    const e164 = toE164(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 050 123 4567." });
      return z.NEVER;
    }
    return e164;
  });

export const ROLES = ["student", "staff"] as const;
export const GENDERS = ["female", "male", "other", "prefer_not"] as const;

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Enter your name." })
    .max(100, { error: "Keep it under 100 characters." }),
  phone: phoneSchema,
  role: z.enum(ROLES, { error: "Choose student or staff." }),
  gender: z
    .enum(GENDERS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  yearOrDept: z.string().trim().max(100, { error: "Keep it under 100 characters." }).optional(),
  acceptTerms: z.literal(true, { error: "You need to accept the Terms and Privacy Policy." }),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

/** Reads the onboarding form. Used by both the browser pre-check and the action. */
export function readOnboardingForm(formData: FormData) {
  return {
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? "",
    gender: formData.get("gender") ?? "",
    yearOrDept: formData.get("yearOrDept") ?? "",
    // Radix Checkbox submits "on" when ticked and nothing otherwise.
    acceptTerms: formData.get("acceptTerms") === "on",
  };
}

/** A DNS domain such as `aus.edu` (lower-cased, no protocol, no path). */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^@/, "").replace(/\.$/, ""))
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/, {
        error: "Use a domain like university.edu",
      }),
  );

/** Comma / space / newline separated list of domains. */
export const domainListSchema = z
  .string()
  .transform((s) => s.split(/[\s,]+/).filter(Boolean))
  .pipe(
    z
      .array(domainSchema)
      .min(1, { error: "Add at least one email domain." })
      .max(5, { error: "At most 5 domains." }),
  );

export const collegeRequestSchema = z.object({
  email: emailSchema,
  collegeName: z.string().trim().min(2, { error: "Enter the college name." }).max(200),
  city: z.string().trim().min(1, { error: "Enter the city." }).max(100),
  domains: domainListSchema,
  website: z
    .url({ protocol: /^https?$/, error: "Enter a full URL, e.g. https://www.university.edu" })
    .max(300)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const optionalCoord = (min: number, max: number) =>
  z
    .union([z.literal("").transform(() => undefined), z.coerce.number().min(min).max(max)])
    .optional();

export const approveCollegeSchema = z
  .object({
    requestId: z.uuid(),
    name: z.string().trim().min(2).max(200),
    shortName: z.string().trim().min(1).max(30),
    city: z.string().trim().min(1).max(100),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, { error: "Two-letter country code, e.g. AE" }),
    domains: domainListSchema,
    lat: optionalCoord(-90, 90),
    lng: optionalCoord(-180, 180),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    error: "Give both latitude and longitude, or neither.",
    path: ["lat"],
  });
