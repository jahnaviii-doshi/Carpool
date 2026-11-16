import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { isValidLatLng } from "@/lib/geo/distance";
import { getGeocoder } from "@/lib/geo/server";
import type { LatLng } from "@/lib/geo/types";

/**
 * Address search / reverse geocoding proxy. Runs on the server so that API
 * keys stay secret, Nominatim's usage policy (1 req/s, cache) can be honoured,
 * and searches are not sent from the user's device to third parties.
 * Signed-in users only, with a per-user limit.
 */
const querySchema = z.union([
  z.object({ q: z.string().trim().min(2).max(200) }),
  z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }),
]);

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.profile?.email_verified_at) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (rateLimited(session.user.id)) {
    return NextResponse.json({ error: "Too many searches. Wait a moment." }, { status: 429 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search." }, { status: 400 });
  }

  // Bias results towards the user's own campus.
  const { data: college } = await session.supabase
    .from("my_college")
    .select("country_code, campus_lat, campus_lng")
    .maybeSingle();
  const near = college ? toLatLng(college.campus_lat, college.campus_lng) : undefined;

  try {
    const geocoder = getGeocoder();
    if ("q" in parsed.data) {
      const places = await geocoder.search(parsed.data.q, {
        near,
        countryCodes: college?.country_code ? [college.country_code.toLowerCase()] : undefined,
        limit: 6,
      });
      return NextResponse.json(
        { places },
        { headers: { "Cache-Control": "private, max-age=300" } },
      );
    }
    const place = await geocoder.reverse({ lat: parsed.data.lat, lng: parsed.data.lng });
    return NextResponse.json({ place }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json(
      {
        error: "Address search is unavailable right now. You can still pick the place on the map.",
      },
      { status: 502 },
    );
  }
}

function toLatLng(lat: number | null, lng: number | null): LatLng | undefined {
  const p = { lat: lat ?? Number.NaN, lng: lng ?? Number.NaN };
  return isValidLatLng(p) ? p : undefined;
}
