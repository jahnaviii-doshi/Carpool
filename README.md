# CampusPool

A carpool web app (mobile-first PWA) for college students and staff. Drivers
post rides, riders post requests, and the app matches people **from the same
college only**. You sign in with your college email, and your college is
worked out from the email domain; nobody can type it in.

The full product spec is in [`SPEC.md`](./SPEC.md). Work is done in the
milestones listed there; this README grows with each one.

| Milestone          | Status  |
| ------------------ | ------- |
| 1. Scaffold        | ✅ done |
| 2. Auth & colleges | ⏳ next |
| 3–9                | —       |

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase
(Postgres 17 + PostGIS, Auth, Realtime) · Zod · Vitest · Playwright · pgTAP.

## Local setup

Requirements: Node 20+, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start            # starts local Supabase in Docker (first run pulls images)
pnpm exec supabase status -o env   # shows API_URL and ANON_KEY
cp .env.example .env.local         # then paste API_URL / ANON_KEY into it
pnpm dev                 # http://localhost:3000
```

Notes:

- The local database listens on port **54342** (not Supabase's default 54322;
  see `supabase/config.toml`). The API is on 54321 and the local email
  inbox (Mailpit, where OTP emails land) on http://127.0.0.1:54324.
- If Docker Hub rate-limits image pulls, pull Supabase's images from GitHub's
  registry instead: `export SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io`.
- After changing the schema, regenerate types with `pnpm db:types`. CI fails
  if `lib/supabase/database.types.ts` is out of date.

## Tests

```bash
pnpm lint          # ESLint, zero warnings allowed
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest unit tests
pnpm test:db       # pgTAP tests in supabase/tests (needs `pnpm db:start`)
pnpm build && pnpm test:e2e   # Playwright against a production build
pnpm check         # lint + typecheck + unit + db tests
```

To use an already-installed Chromium for Playwright, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome`.

## How sign-in works

1. You enter your college email. The server checks its domain **before** any
   code is sent (`check_signup_email`): personal providers (Gmail, Outlook,
   Yahoo, …) are rejected, unknown colleges get a "Request it →" link.
   Domains match on a dot boundary: `cs.aus.edu` is AUS, `fakeaus.edu` is not.
2. Supabase emails a **6-digit code** (never a magic link, since college mail
   scanners open links early and burn them).
3. The database enforces the same rule on its own, so calling Supabase Auth
   directly does not get around it:
   - the **Before User Created auth hook** (`hook_before_user_created`) rejects
     sign-ups from unapproved domains;
   - **triggers on `auth.users`** reject the same, even if the hook is off, and
     stop an email change from moving an account to another college;
   - the profile's `college_id` is set from the domain by a trigger and no API
     role can change it.
4. After the code is verified, `record_email_verification()` stores the time
   of the OTP, read from the signed JWT. Until then the account can see
   nothing. Re-verification is required every 180 days
   (`app_settings.reverify_after_days`); overdue users can read but not write.

## Privacy model so far

| Data                                                 | Who can read it                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `profiles` (full row)                                | only you                                                             |
| `profiles_public` (first name, avatar, role, rating) | verified users of your college                                       |
| `private_contacts` (phone)                           | only you (Milestone 5 adds: the other person in an accepted booking) |
| gender                                               | only you; used only for women-only matching                          |
| `college_requests`, `college_domains`                | super admins                                                         |

All of this is enforced by RLS, and tested two ways: pgTAP
(`supabase/tests/030_rls_college_isolation.test.sql`) and the raw Supabase JS
client acting as real signed-in users (`e2e/rls-raw-client.spec.ts`).

## Rides, locations and privacy

- **Exact vs public.** Every place has an exact point and label (e.g. "Villa
  12, Street 5, Al Nahda"), seen only by its owner, and a public **area**
  ("Al Nahda, Sharjah") plus a **fuzzed point**, which is what other users get.
- **Fuzzing.** Both ends of every offer and request are moved 200–400 m. The
  offset comes from `HMAC(secret, user + ~100 m grid cell)` instead of a fresh
  random number, so a driver who posts from home every day always shows the
  same fuzzed point and averaging many posts reveals nothing. The secret is in
  the `private` schema, which no API role can read.
- **Recurring rides.** "Repeat every week" saves a _series template_ that is
  never shown or matched itself. It is turned into ordinary dated rides for the
  next 14 days (`app_settings.series_horizon_days`) when saved and daily by
  `pg_cron` (`materialize-ride-series`), so seats and bookings always belong
  to one specific date.
- **Writes** go only through RPCs (`save_vehicle`, `save_ride_offer`,
  `save_ride_request`, `cancel_*`), which check `can_write()`, ownership,
  time (entered in the college's time zone), distance from campus, seats vs
  vehicle, women-only eligibility, cost-sharing rules, and a daily limit
  (`app_settings.max_posts_per_day`, default 10).

## Matching

`find_matches_for_request(id)` (drivers for a rider) and
`find_matches_for_offer(id)` (riders for a driver) apply the hard rules in
SQL; only the owner of the request/offer can call them.

1. Same college (checked again inside the function, on top of RLS).
2. Open, dated ride with enough free seats.
3. Departure ± flexibility overlaps the rider's window (inclusive). Weekly
   requests/offers are compared by weekday and local time of day.
4. Pickup within 1.5 km of the driver's route (`app_settings.match_pickup_radius_m`).
   The route is the road route if a router is configured, else the straight line.
5. Drop-off within 2 km of the driver's destination (`match_dest_radius_m`),
   **or** near the route _further along_ than the pickup
   (`ST_LineLocatePoint`), so nobody is matched against the direction of travel.
6. Women-only rules both ways; no match if either person blocked the other.

Ranking is a pure function, `lib/matching/score.ts`, with every weight and
threshold in `lib/matching/config.ts`: detour (50%), time gap (30%) and rating
(20%, shrunk towards 4★ so one 5★ review doesn't beat fifty 4.8★ reviews).

**Privacy:** results carry only what the public views already show (first
name, rating, vehicle summary, area, fuzzed points). The detour figure is
rounded to 500 m in SQL and shown as "under 1 km" / "about 1.5 km", so
repeated searches can't be used to trace someone's exact route. On the map,
other people appear only as 400 m circles.

## Maps & address search

- Map tiles: Leaflet with `NEXT_PUBLIC_MAP_TILE_URL` (OpenStreetMap by default;
  use a hosted tile provider in production).
- Address search goes through our own `/api/geocode` (signed-in users only,
  per-user limit, cached), so API keys stay on the server and searches aren't
  sent from the user's device. Pick the provider with `GEOCODER_PROVIDER`:

| Value                 | Needs                                                    | Notes                                                                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `nominatim` (default) | nothing                                                  | Public OSM server: max 1 request/second (enforced), fine for development and small pilots |
| `google`              | `GOOGLE_MAPS_API_KEY` (Places API (New) + Geocoding API) | Best coverage in the UAE; recommended for production                                      |
| `ola`                 | `OLA_MAPS_API_KEY`                                       | Strongest in India                                                                        |
| `fixture`             | nothing                                                  | Offline list of places around AUS; used by tests and CI                                   |

- Routing is optional (`ROUTER_PROVIDER=osrm|ors`). Without it, matching uses
  the straight line from start to destination.

## Region defaults (UAE)

The first college is the **American University of Sharjah** (`aus.edu`,
University City, Sharjah), so region defaults live in `lib/config/region.ts`
and are set for the UAE: times shown in `Asia/Dubai`, phone numbers default to
`+971`, the SOS button dials **999**, and currency is AED. Set
`NEXT_PUBLIC_REGION=IN` for the India defaults from the original spec.

**Cost-sharing is off for the UAE.** Carrying passengers for money in a
private car counts as illegal passenger transport in the UAE, so the
cost-per-seat field is hidden, and the database refuses a cost, unless the
college has `cost_sharing_enabled = true`. Where it is enabled the cost is
capped at `max_cost_per_km × route km ÷ seats` (`app_settings`).

## Super admins

Admin emails are never committed. Grant one with:

```bash
pnpm admin:grant someone@aus.edu            # local database
DATABASE_URL="postgresql://..." pnpm admin:grant someone@aus.edu   # cloud
pnpm admin:grant --revoke someone@aus.edu
```

The address must be at an approved college domain. Rights take effect once
that person has signed in with an email code. `pnpm db:reset` clears local
grants, so re-run the command afterwards.

## Adding a college

- **Through the app:** anyone can submit `/request-college` (their own email
  must be at one of the domains they claim; 3 requests per email per day).
  A super admin reviews it at `/admin`, checks the domains really belong to
  the college, and approves. Approving creates the `colleges` and
  `college_domains` rows, and sign-in opens for those domains immediately.
- **Production colleges** that should exist everywhere go in a migration,
  like `supabase/migrations/20261116010200_seed_aus.sql` (AUS, `aus.edu`).
- **Local-only test colleges** go in `supabase/seed.sql` (it has
  `testcollege.example` for trying cross-college isolation by hand).

## Local email

OTP emails never leave your machine in local development. Open Mailpit at
http://127.0.0.1:54324 to read them.

## Deploy

Arrives in Milestone 9 (Vercel + Supabase cloud).
