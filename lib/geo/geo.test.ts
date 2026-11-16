import { describe, expect, it, vi } from "vitest";

import { areaFromComponents, coarseArea, shortLabel } from "@/lib/geo/area";
import { approxDistanceLabel, haversineM, isValidLatLng } from "@/lib/geo/distance";
import { FixtureGeocoder } from "@/lib/geo/fixture";
import { GoogleGeocoder, placeFromGeocodeResult } from "@/lib/geo/google";
import { NominatimGeocoder, placeFromNominatim } from "@/lib/geo/nominatim";
import { OlaGeocoder, placeFromOlaPrediction } from "@/lib/geo/ola";
import { OsrmRouter, routeOrStraightLine, StraightLineRouter, thinRoute } from "@/lib/geo/routers";
import type { Router } from "@/lib/geo/types";

const AUS = { lat: 25.312, lng: 55.4905 };
const AL_NAHDA = { lat: 25.305, lng: 55.37 };

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("distance", () => {
  it("measures AUS → Al Nahda at roughly 12 km", () => {
    const d = haversineM(AUS, AL_NAHDA);
    expect(d).toBeGreaterThan(11_500);
    expect(d).toBeLessThan(12_700);
  });

  it("rounds displayed distances to 0.5 km and hides anything under 1 km", () => {
    expect(approxDistanceLabel(420)).toBe("under 1 km");
    expect(approxDistanceLabel(1240)).toBe("about 1 km");
    expect(approxDistanceLabel(1260)).toBe("about 1.5 km");
    expect(approxDistanceLabel(12_100)).toBe("about 12 km");
  });

  it("validates coordinates", () => {
    expect(isValidLatLng(AUS)).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
  });
});

describe("area helpers", () => {
  it("combines neighbourhood and city, skipping blanks and duplicates", () => {
    expect(coarseArea({ neighbourhood: [undefined, "Al Nahda"], city: ["Sharjah"] })).toBe(
      "Al Nahda, Sharjah",
    );
    expect(coarseArea({ neighbourhood: ["Sharjah"], city: ["Sharjah"] })).toBe("Sharjah");
    expect(coarseArea({})).toBeNull();
  });

  it("shortens long display names", () => {
    expect(shortLabel("A, B, C, D, E")).toBe("A, B, C");
  });

  it("reads Google-style address components", () => {
    expect(
      areaFromComponents([
        { long_name: "12", types: ["street_number"] },
        { long_name: "Al Nahda", types: ["sublocality_level_1", "sublocality"] },
        { long_name: "Sharjah", types: ["locality", "political"] },
      ]),
    ).toBe("Al Nahda, Sharjah");
  });
});

describe("NominatimGeocoder", () => {
  const item = {
    lat: "25.3050",
    lon: "55.3700",
    name: "Al Nahda Park",
    display_name: "Al Nahda Park, Al Nahda Street, Al Nahda, Sharjah, United Arab Emirates",
    address: { suburb: "Al Nahda", city: "Sharjah", state: "Sharjah" },
  };

  it("parses a search result into label + coarse area", () => {
    expect(placeFromNominatim(item)).toEqual({
      lat: 25.305,
      lng: 55.37,
      label: "Al Nahda Park, Al Nahda Street, Al Nahda",
      area: "Al Nahda, Sharjah",
    });
  });

  it("sends an identifying User-Agent and a campus viewbox", async () => {
    const fetchImpl = fakeFetch([item]);
    const g = new NominatimGeocoder("https://nominatim.example", "CampusPool-test", fetchImpl);
    const places = await g.search("al nahda", { near: AUS, countryCodes: ["ae"] });
    expect(places).toHaveLength(1);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("countrycodes")).toBe("ae");
    expect(url.searchParams.get("viewbox")).toBeTruthy();
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("CampusPool-test");
  });

  it("keeps the exact tapped point on reverse lookups", async () => {
    const g = new NominatimGeocoder("https://n.example", "ua", fakeFetch(item));
    const p = await g.reverse({ lat: 25.30512, lng: 55.37033 });
    expect(p).toMatchObject({ lat: 25.30512, lng: 55.37033, area: "Al Nahda, Sharjah" });
  });

  it("returns null when Nominatim has no address", async () => {
    const g = new NominatimGeocoder(
      "https://n.example",
      "ua",
      fakeFetch({ error: "Unable to geocode" }),
    );
    expect(await g.reverse(AUS)).toBeNull();
  });
});

describe("GoogleGeocoder", () => {
  it("parses Places text search results", async () => {
    const g = new GoogleGeocoder(
      "key",
      fakeFetch({
        places: [
          {
            displayName: { text: "Sahara Centre" },
            formattedAddress: "Al Nahda St, Al Nahda, Sharjah, UAE",
            location: { latitude: 25.2975, longitude: 55.3735 },
            addressComponents: [
              { longText: "Al Nahda", types: ["sublocality_level_1"] },
              { longText: "Sharjah", types: ["locality"] },
            ],
          },
        ],
      }),
    );
    expect(await g.search("sahara centre", { near: AUS, countryCodes: ["ae"] })).toEqual([
      {
        lat: 25.2975,
        lng: 55.3735,
        label: "Sahara Centre, Al Nahda St, Al Nahda",
        area: "Al Nahda, Sharjah",
      },
    ]);
  });

  it("parses geocoding results", () => {
    expect(
      placeFromGeocodeResult({
        formatted_address: "University City, Sharjah, UAE",
        address_components: [{ long_name: "Sharjah", types: ["locality"] }],
        geometry: { location: { lat: 25.31, lng: 55.49 } },
      }),
    ).toMatchObject({ area: "Sharjah", label: "University City, Sharjah, UAE" });
  });

  it("throws on HTTP errors", async () => {
    await expect(new GoogleGeocoder("key", fakeFetch({}, 403)).search("x")).rejects.toThrow();
  });
});

describe("OlaGeocoder", () => {
  const prediction = {
    description: "Sahara Centre, Al Nahda, Sharjah, United Arab Emirates",
    geometry: { location: { lat: 25.2975, lng: 55.3735 } },
    terms: [
      { value: "Sahara Centre" },
      { value: "Al Nahda" },
      { value: "Sharjah" },
      { value: "United Arab Emirates" },
    ],
  };

  it("parses autocomplete predictions", () => {
    expect(placeFromOlaPrediction(prediction)).toEqual({
      lat: 25.2975,
      lng: 55.3735,
      label: "Sahara Centre, Al Nahda, Sharjah",
      area: "Al Nahda, Sharjah",
    });
  });

  it("drops predictions without coordinates", async () => {
    const g = new OlaGeocoder(
      "key",
      fakeFetch({ predictions: [{ description: "x" }, prediction] }),
    );
    expect(await g.search("sahara")).toHaveLength(1);
  });
});

describe("FixtureGeocoder", () => {
  const g = new FixtureGeocoder();

  it("finds places by all words", async () => {
    const [p] = await g.search("sahara centre");
    expect(p.area).toBe("Al Nahda, Sharjah");
  });

  it("reverse-geocodes to the nearest known area", async () => {
    expect(await g.reverse({ lat: 25.3052, lng: 55.3702 })).toMatchObject({
      area: "Al Nahda, Sharjah",
    });
  });
});

describe("routers", () => {
  it("straight-line router joins the two points", async () => {
    const r = await new StraightLineRouter().route(AL_NAHDA, AUS);
    expect(r.coordinates).toEqual([
      [55.37, 25.305],
      [55.4905, 25.312],
    ]);
    expect(r.distanceM).toBeCloseTo(haversineM(AL_NAHDA, AUS));
  });

  it("parses an OSRM route", async () => {
    const osrm = new OsrmRouter(
      "https://osrm.example",
      fakeFetch({
        code: "Ok",
        routes: [
          {
            distance: 14_000,
            geometry: {
              type: "LineString",
              coordinates: [
                [55.37, 25.305],
                [55.43, 25.31],
                [55.4905, 25.312],
              ],
            },
          },
        ],
      }),
    );
    const r = await osrm.route(AL_NAHDA, AUS);
    expect(r.distanceM).toBe(14_000);
    expect(r.coordinates).toHaveLength(3);
  });

  it("falls back to a straight line when the router fails", async () => {
    const broken: Router = {
      name: "broken",
      route: async () => {
        throw new Error("down");
      },
    };
    const r = await routeOrStraightLine(broken, AL_NAHDA, AUS);
    expect(r.coordinates).toHaveLength(2);
  });

  it("thins long routes to a maximum number of points", () => {
    const coords = Array.from({ length: 2000 }, (_, i) => [i, i] as [number, number]);
    const thin = thinRoute(coords, 100);
    expect(thin).toHaveLength(100);
    expect(thin[0]).toEqual([0, 0]);
    expect(thin[99]).toEqual([1999, 1999]);
  });
});
