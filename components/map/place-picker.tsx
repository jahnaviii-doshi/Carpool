"use client";

import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { FieldError } from "@/components/form-message";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LatLng, Place } from "@/lib/geo/types";

type Props = {
  /** Field prefix: submits `${name}Lat`, `${name}Lng`, `${name}Label`, `${name}Area`. */
  name: string;
  label: string;
  campus: LatLng | null;
  defaultPlace?: Place | null;
  /** Offered as a one-tap choice (e.g. the campus). */
  shortcut?: Place | null;
  errors?: string[];
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Search failed.");
  return body as T;
}

/**
 * Pick a place by address search, by tapping the map, or with the device's
 * location. The exact point and label are only ever sent to our server; the
 * public "area" is what other users see.
 */
export function PlacePicker({ name, label, campus, defaultPlace, shortcut, errors }: Props) {
  const id = useId();
  const [place, setPlace] = useState<Place | null>(defaultPlace ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      setProblem(null);
      try {
        const { places } = await fetchJson<{ places: Place[] }>(
          `/api/geocode?q=${encodeURIComponent(q)}`,
          ctrl.signal,
        );
        setResults(places);
        if (places.length === 0) setProblem("No matches. Try another name or pick on the map.");
      } catch (e) {
        if (!ctrl.signal.aborted) setProblem((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  async function pickPoint(point: LatLng) {
    setBusy(true);
    setProblem(null);
    try {
      const { place: found } = await fetchJson<{ place: Place | null }>(
        `/api/geocode?lat=${point.lat}&lng=${point.lng}`,
      );
      setPlace(found ?? { ...point, label: "Pinned location", area: null });
    } catch {
      setPlace({ ...point, label: "Pinned location", area: null });
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setProblem("Your browser can't share its location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => pickPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setBusy(false);
        setProblem("Location permission was denied.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function choose(p: Place) {
    setPlace(p);
    setQuery("");
    setResults([]);
  }

  const center = place ?? campus ?? { lat: 25.312, lng: 55.4905 };
  const errorId = `${id}-error`;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={errors ? errorId : undefined}>
      <legend className="mb-1 text-sm font-medium">{label}</legend>

      {place ? (
        <>
          <input type="hidden" name={`${name}Lat`} value={place.lat} />
          <input type="hidden" name={`${name}Lng`} value={place.lng} />
          <input type="hidden" name={`${name}Label`} value={place.label} />
          <input type="hidden" name={`${name}Area`} value={place.area ?? ""} />
          <div
            className="bg-accent flex items-start gap-3 rounded-md border p-3"
            data-testid={`${name}-chosen`}
          >
            <MapPin className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{place.label}</p>
              <p className="text-muted-foreground text-sm">
                Others see: {place.area ?? "an approximate location"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPlace(null)}
              aria-label={`Change ${label.toLowerCase()}`}
            >
              <X aria-hidden />
              Change
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id={`${id}-search`}
              type="search"
              placeholder="Search an address or place"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${label.toLowerCase()}`}
              aria-invalid={errors ? true : undefined}
              autoComplete="off"
            />
            {busy ? (
              <Loader2
                className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
                aria-label="Searching"
              />
            ) : null}
          </div>

          {results.length > 0 ? (
            <ul className="divide-y rounded-md border" aria-label={`${label} results`}>
              {results.map((r) => (
                <li key={`${r.lat},${r.lng},${r.label}`}>
                  <button
                    type="button"
                    className="hover:bg-accent focus-visible:bg-accent flex w-full flex-col items-start gap-0.5 p-3 text-left outline-none"
                    onClick={() => choose(r)}
                  >
                    <span className="font-medium">{r.label}</span>
                    {r.area ? (
                      <span className="text-muted-foreground text-sm">{r.area}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {shortcut ? (
              <Button type="button" variant="outline" size="sm" onClick={() => choose(shortcut)}>
                <MapPin aria-hidden />
                {shortcut.label}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
              <MapPin aria-hidden />
              {showMap ? "Hide map" : "Pick on map"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
              <Crosshair aria-hidden />
              Use my location
            </Button>
          </div>
        </>
      )}

      {showMap ? (
        <div className="flex flex-col gap-1">
          <MapView
            center={center}
            zoom={place ? 15 : 12}
            focus={place}
            onPick={pickPoint}
            ariaLabel={`Map for ${label.toLowerCase()}. Tap to choose a point.`}
            pins={[
              ...(campus
                ? [{ id: "campus", kind: "campus" as const, ...campus, title: "Campus" }]
                : []),
              ...(place
                ? [{ id: "chosen", kind: "start" as const, lat: place.lat, lng: place.lng }]
                : []),
            ]}
          />
          <p className="text-muted-foreground text-xs">Tap the map to choose the exact point.</p>
        </div>
      ) : null}

      {problem ? <p className="text-muted-foreground text-sm">{problem}</p> : null}
      <FieldError id={errorId} errors={errors} />
    </fieldset>
  );
}
