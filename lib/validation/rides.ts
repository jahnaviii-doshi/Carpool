import { z } from "zod";

/** A place picked in the form: exact point + private label + public area. */
const placeSchema = (what: string) =>
  z.object(
    {
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      label: z.string().trim().min(1).max(300),
      area: z
        .string()
        .trim()
        .max(120)
        .optional()
        .transform((v) => v || undefined),
    },
    { error: `Choose the ${what}.` },
  );

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Choose a time." });
const isoDate = z.iso.date({ error: "Choose a date." });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep it under ${max} characters.` })
    .optional()
    .transform((v) => v || undefined);
const days = z.array(z.coerce.number().int().min(0).max(6));

function readPlace(fd: FormData, prefix: string) {
  const lat = fd.get(`${prefix}Lat`);
  const lng = fd.get(`${prefix}Lng`);
  if (!lat || !lng) return undefined;
  return { lat, lng, label: fd.get(`${prefix}Label`) ?? "", area: fd.get(`${prefix}Area`) ?? "" };
}

const recurrence = <
  T extends { repeat: boolean; recurringDays: number[]; recurringUntil?: string; date: string },
>(
  v: T,
  ctx: z.RefinementCtx,
) => {
  if (!v.repeat) return;
  if (v.recurringDays.length === 0) {
    ctx.addIssue({ code: "custom", path: ["recurringDays"], message: "Pick at least one day." });
  }
  if (!v.recurringUntil) {
    ctx.addIssue({ code: "custom", path: ["recurringUntil"], message: "Choose when it ends." });
  } else if (v.recurringUntil < v.date) {
    ctx.addIssue({
      code: "custom",
      path: ["recurringUntil"],
      message: "End after the first date.",
    });
  }
};

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export const vehicleSchema = z
  .object({
    id: z.uuid().optional(),
    type: z.enum(["car", "bike"], { error: "Choose car or bike." }),
    make: z.string().trim().min(1, { error: "Enter the make, e.g. Toyota." }).max(40),
    model: z.string().trim().min(1, { error: "Enter the model, e.g. Corolla." }).max(40),
    color: z.string().trim().min(1, { error: "Enter the colour." }).max(30),
    seats: z.coerce
      .number()
      .int()
      .min(1, { error: "At least 1 seat." })
      .max(7, { error: "At most 7 seats." }),
    plateNumber: z
      .string()
      .trim()
      .toUpperCase()
      .transform((s) => s.replace(/\s+/g, " "))
      .pipe(
        z.string().regex(/^[A-Z0-9][A-Z0-9 -]{0,18}[A-Z0-9]$/, {
          error: "Enter the plate as shown, e.g. SHJ 3 12345.",
        }),
      ),
  })
  .refine((v) => v.type === "car" || v.seats === 1, {
    path: ["seats"],
    error: "A bike carries one passenger.",
  });

export function readVehicleForm(fd: FormData) {
  return {
    id: fd.get("id") || undefined,
    type: fd.get("type") ?? "",
    make: fd.get("make") ?? "",
    model: fd.get("model") ?? "",
    color: fd.get("color") ?? "",
    seats: fd.get("seats") ?? "",
    plateNumber: fd.get("plateNumber") ?? "",
  };
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------
export const offerSchema = z
  .object({
    id: z.uuid().optional(),
    vehicleId: z.uuid({ error: "Choose a vehicle." }),
    origin: placeSchema("starting point"),
    dest: placeSchema("destination"),
    date: isoDate,
    time: hhmm,
    flexMinutes: z.coerce.number().int().min(0).max(120),
    seats: z.coerce.number().int().min(1, { error: "At least 1 seat." }).max(7),
    repeat: z.boolean(),
    recurringDays: days,
    recurringUntil: isoDate.optional(),
    costPerSeat: z
      .union([z.literal("").transform(() => undefined), z.coerce.number().int().min(0).max(10_000)])
      .optional(),
    womenOnly: z.boolean(),
    notes: optionalText(500),
  })
  .superRefine(recurrence);

export type OfferInput = z.output<typeof offerSchema>;

export function readOfferForm(fd: FormData) {
  return {
    id: fd.get("id") || undefined,
    vehicleId: fd.get("vehicleId") ?? "",
    origin: readPlace(fd, "origin"),
    dest: readPlace(fd, "dest"),
    date: fd.get("date") ?? "",
    time: fd.get("time") ?? "",
    flexMinutes: fd.get("flexMinutes") ?? "15",
    seats: fd.get("seats") ?? "",
    repeat: fd.get("repeat") === "on",
    recurringDays: fd.getAll("recurringDays"),
    recurringUntil: fd.get("recurringUntil") || undefined,
    costPerSeat: fd.get("costPerSeat") ?? "",
    womenOnly: fd.get("womenOnly") === "on",
    notes: fd.get("notes") ?? "",
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
export const requestSchema = z
  .object({
    id: z.uuid().optional(),
    pickup: placeSchema("pickup point"),
    dest: placeSchema("destination"),
    date: isoDate,
    windowStart: hhmm,
    windowEnd: hhmm,
    seatsNeeded: z.coerce.number().int().min(1).max(6),
    womenOnlyPref: z.boolean(),
    repeat: z.boolean(),
    recurringDays: days,
    recurringUntil: isoDate.optional(),
    notes: optionalText(500),
  })
  .refine((v) => v.windowEnd > v.windowStart, {
    path: ["windowEnd"],
    error: "The latest time must be after the earliest time.",
  })
  .superRefine(recurrence);

export type RequestInput = z.output<typeof requestSchema>;

export function readRequestForm(fd: FormData) {
  return {
    id: fd.get("id") || undefined,
    pickup: readPlace(fd, "pickup"),
    dest: readPlace(fd, "dest"),
    date: fd.get("date") ?? "",
    windowStart: fd.get("windowStart") ?? "",
    windowEnd: fd.get("windowEnd") ?? "",
    seatsNeeded: fd.get("seatsNeeded") ?? "1",
    womenOnlyPref: fd.get("womenOnlyPref") === "on",
    repeat: fd.get("repeat") === "on",
    recurringDays: fd.getAll("recurringDays"),
    recurringUntil: fd.get("recurringUntil") || undefined,
    notes: fd.get("notes") ?? "",
  };
}
