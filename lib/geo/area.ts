/**
 * Builds the coarse public "area" name for a place from address parts:
 * neighbourhood-level name plus city, e.g. "Al Nahda, Sharjah". Never
 * includes street names, building numbers or postcodes.
 */
export function coarseArea(parts: {
  neighbourhood?: (string | undefined | null)[];
  city?: (string | undefined | null)[];
}): string | null {
  const first = (xs?: (string | undefined | null)[]) =>
    xs?.map((x) => x?.trim()).find((x): x is string => Boolean(x));
  const n = first(parts.neighbourhood);
  const c = first(parts.city);
  const out = [n, c].filter((x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i);
  return out.length ? out.join(", ").slice(0, 120) : null;
}

/** Shortens a long display name to its first few comma-separated parts. */
export function shortLabel(displayName: string, parts = 3): string {
  return displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, parts)
    .join(", ")
    .slice(0, 300);
}

/** Google / Ola style address_components → coarse area. */
export type AddressComponent = { long_name?: string; longText?: string; types: string[] };

export function areaFromComponents(components: AddressComponent[] | undefined): string | null {
  const byType = (...types: string[]) =>
    types.map(
      (t) =>
        components?.find((c) => c.types.includes(t))?.long_name ??
        components?.find((c) => c.types.includes(t))?.longText,
    );
  return coarseArea({
    neighbourhood: byType("sublocality_level_1", "sublocality", "neighborhood"),
    city: byType("locality", "administrative_area_level_2", "administrative_area_level_1"),
  });
}
