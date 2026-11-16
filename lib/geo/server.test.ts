import { describe, expect, it, vi } from "vitest";

import { CachedThrottledGeocoder } from "@/lib/geo/server";
import type { Geocoder } from "@/lib/geo/types";

function counting(): Geocoder & { calls: number[] } {
  const calls: number[] = [];
  return {
    name: "counting",
    calls,
    search: vi.fn(async (q: string) => {
      calls.push(Date.now());
      return [{ lat: 1, lng: 2, label: q, area: null }];
    }),
    reverse: vi.fn(async (p) => {
      calls.push(Date.now());
      return { ...p, label: "x", area: null };
    }),
  };
}

describe("CachedThrottledGeocoder", () => {
  it("serves repeated queries from cache (case and spacing insensitive)", async () => {
    const inner = counting();
    const g = new CachedThrottledGeocoder(inner, 0);
    await g.search("Al Nahda");
    await g.search("  al nahda ");
    expect(inner.calls).toHaveLength(1);
  });

  it("rounds reverse lookups to ~10 m for caching", async () => {
    const inner = counting();
    const g = new CachedThrottledGeocoder(inner, 0);
    await g.reverse({ lat: 25.30501, lng: 55.37001 });
    await g.reverse({ lat: 25.30502, lng: 55.37002 });
    expect(inner.calls).toHaveLength(1);
  });

  it("spaces upstream calls by the minimum gap", async () => {
    const inner = counting();
    const g = new CachedThrottledGeocoder(inner, 120);
    await Promise.all([g.search("a"), g.search("b"), g.search("c")]);
    expect(inner.calls).toHaveLength(3);
    expect(inner.calls[1] - inner.calls[0]).toBeGreaterThanOrEqual(110);
    expect(inner.calls[2] - inner.calls[1]).toBeGreaterThanOrEqual(110);
  });
});
