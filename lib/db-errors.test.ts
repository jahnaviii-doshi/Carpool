import { describe, expect, it } from "vitest";

import { userMessage } from "./db-errors";

describe("userMessage", () => {
  it("passes through messages from our own validation errors", () => {
    expect(userMessage({ code: "22023", message: "invalid phone number" })).toBe(
      "Invalid phone number.",
    );
  });

  it("hides internal errors", () => {
    expect(userMessage({ code: "42P01", message: 'relation "x" does not exist' })).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("hides permission errors", () => {
    expect(userMessage({ code: "42501", message: "permission denied" }, "Not allowed.")).toBe(
      "Not allowed.",
    );
  });
});
