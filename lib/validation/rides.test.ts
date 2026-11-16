import { describe, expect, it } from "vitest";

import { offerSchema, requestSchema, vehicleSchema } from "./rides";

const place = { lat: "25.305", lng: "55.37", label: "Al Nahda Park", area: "Al Nahda, Sharjah" };
const campus = { lat: "25.312", lng: "55.4905", label: "AUS Main Gate", area: "" };

describe("vehicleSchema", () => {
  const car = {
    type: "car",
    make: "Toyota",
    model: "Corolla",
    color: "White",
    seats: "3",
    plateNumber: "shj  3 12345",
  };

  it("normalises the plate", () => {
    expect(vehicleSchema.parse(car).plateNumber).toBe("SHJ 3 12345");
  });

  it("limits bikes to one passenger", () => {
    expect(vehicleSchema.safeParse({ ...car, type: "bike", seats: "2" }).success).toBe(false);
  });
});

describe("offerSchema", () => {
  const base = {
    vehicleId: "5b0f8f43-5c3a-4a33-9a59-2c2b3c1f8b11",
    origin: place,
    dest: campus,
    date: "2026-11-18",
    time: "08:15",
    flexMinutes: "15",
    seats: "2",
    repeat: false,
    recurringDays: [],
    costPerSeat: "",
    womenOnly: false,
    notes: "",
  };

  it("parses a one-off offer", () => {
    const out = offerSchema.parse(base);
    expect(out.origin).toEqual({
      lat: 25.305,
      lng: 55.37,
      label: "Al Nahda Park",
      area: "Al Nahda, Sharjah",
    });
    expect(out.dest.area).toBeUndefined();
    expect(out.costPerSeat).toBeUndefined();
    expect(out.notes).toBeUndefined();
  });

  it("requires a picked place", () => {
    const r = offerSchema.safeParse({ ...base, origin: undefined });
    expect(r.success).toBe(false);
  });

  it("requires days and an end date when repeating", () => {
    const r = offerSchema.safeParse({ ...base, repeat: true });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["recurringDays", "recurringUntil"]);
  });

  it("accepts a weekday series", () => {
    const out = offerSchema.parse({
      ...base,
      repeat: true,
      recurringDays: ["1", "2", "3"],
      recurringUntil: "2027-01-31",
    });
    expect(out.recurringDays).toEqual([1, 2, 3]);
  });

  it("rejects a bad time", () => {
    expect(offerSchema.safeParse({ ...base, time: "25:00" }).success).toBe(false);
  });
});

describe("requestSchema", () => {
  const base = {
    pickup: place,
    dest: campus,
    date: "2026-11-18",
    windowStart: "07:30",
    windowEnd: "08:30",
    seatsNeeded: "1",
    womenOnlyPref: false,
    repeat: false,
    recurringDays: [],
    notes: "",
  };

  it("parses a request", () => {
    expect(requestSchema.parse(base).seatsNeeded).toBe(1);
  });

  it("requires the window to end after it starts", () => {
    const r = requestSchema.safeParse({ ...base, windowEnd: "07:00" });
    expect(r.error?.issues[0].path).toEqual(["windowEnd"]);
  });
});
