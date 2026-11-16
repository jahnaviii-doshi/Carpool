import { describe, expect, it } from "vitest";

import {
  approveCollegeSchema,
  collegeRequestSchema,
  domainListSchema,
  onboardingSchema,
  otpSchema,
  signInSchema,
  toE164,
} from "./auth";

describe("signInSchema", () => {
  it("trims and lower-cases the email", () => {
    expect(signInSchema.parse({ email: "  G00012345@AUS.edu " }).email).toBe("g00012345@aus.edu");
  });

  it("rejects a non-email", () => {
    expect(signInSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("otpSchema", () => {
  it.each(["123456", " 000123 "])("accepts %s", (token) => {
    expect(otpSchema.safeParse({ token }).success).toBe(true);
  });

  it.each(["12345", "1234567", "12a456", ""])("rejects %s", (token) => {
    expect(otpSchema.safeParse({ token }).success).toBe(false);
  });
});

describe("toE164", () => {
  it("reads a local UAE mobile number as +971", () => {
    expect(toE164("050 123 4567")).toBe("+971501234567");
  });

  it("keeps an explicit international number", () => {
    expect(toE164("+91 98765 43210")).toBe("+919876543210");
  });

  it("rejects garbage", () => {
    expect(toE164("12")).toBeNull();
  });
});

describe("onboardingSchema", () => {
  const valid = {
    fullName: "Aisha Khan",
    phone: "0501234567",
    role: "student",
    gender: "",
    yearOrDept: "CS, year 2",
    acceptTerms: true,
  };

  it("parses a valid form and normalises the phone", () => {
    const out = onboardingSchema.parse(valid);
    expect(out.phone).toBe("+971501234567");
    expect(out.gender).toBeUndefined();
  });

  it("requires accepting the terms", () => {
    expect(onboardingSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("rejects an invalid phone", () => {
    expect(onboardingSchema.safeParse({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(onboardingSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });
});

describe("domainListSchema", () => {
  it("splits, trims, strips @ and lower-cases", () => {
    expect(domainListSchema.parse(" @AUS.edu, cs.aus.edu\nstaff.aus.edu. ")).toEqual([
      "aus.edu",
      "cs.aus.edu",
      "staff.aus.edu",
    ]);
  });

  it("rejects a URL", () => {
    expect(domainListSchema.safeParse("https://aus.edu").success).toBe(false);
  });

  it("rejects an empty list", () => {
    expect(domainListSchema.safeParse("  ").success).toBe(false);
  });
});

describe("collegeRequestSchema", () => {
  it("accepts a request without a website", () => {
    const out = collegeRequestSchema.parse({
      email: "dean@uni.test",
      collegeName: "Uni",
      city: "Ajman",
      domains: "uni.test",
      website: "",
    });
    expect(out.website).toBeUndefined();
  });
});

describe("approveCollegeSchema", () => {
  const base = {
    requestId: "5b0f8f43-5c3a-4a33-9a59-2c2b3c1f8b11",
    name: "New University",
    shortName: "NU",
    city: "Ajman",
    countryCode: "ae",
    domains: "newuni.test",
  };

  it("allows no coordinates", () => {
    expect(approveCollegeSchema.parse({ ...base, lat: "", lng: "" }).countryCode).toBe("AE");
  });

  it("requires both coordinates or neither", () => {
    expect(approveCollegeSchema.safeParse({ ...base, lat: "25.3", lng: "" }).success).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(approveCollegeSchema.safeParse({ ...base, lat: "95", lng: "55" }).success).toBe(false);
  });
});
