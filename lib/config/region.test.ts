import { describe, expect, it } from "vitest";

import { getRegion, INDIA, isRegionCode, UAE } from "./region";

describe("getRegion", () => {
  it("defaults to the UAE when nothing is configured", () => {
    expect(getRegion(undefined)).toBe(UAE);
  });

  it("falls back to the UAE for an unknown code", () => {
    expect(getRegion("XX")).toBe(UAE);
  });

  it("returns India when asked", () => {
    expect(getRegion("IN")).toBe(INDIA);
  });

  it("uses UAE emergency number, time zone and currency", () => {
    expect(UAE.emergencyNumber).toBe("999");
    expect(UAE.timeZone).toBe("Asia/Dubai");
    expect(UAE.currency).toBe("AED");
  });

  it("keeps paid cost-sharing off in the UAE", () => {
    expect(UAE.costSharingEnabled).toBe(false);
  });
});

describe("isRegionCode", () => {
  it("narrows known codes only", () => {
    expect(isRegionCode("AE")).toBe(true);
    expect(isRegionCode("ae")).toBe(false);
    expect(isRegionCode(undefined)).toBe(false);
  });
});
