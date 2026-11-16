# Build Prompt: CampusPool — College-Only Carpool App

> Paste this whole file into Claude Code (or save it as `SPEC.md` in an empty repo and say: "Read SPEC.md and build it, following the Working Rules at the bottom.")

---

## 1. What you are building

A carpool web app (mobile-first PWA) for college students and staff.

- **Drivers** with a car (or bike) post rides: where they're starting, where they're going, when, how many seats, and their vehicle details.
- **Riders** who need a lift post requests: pickup location, destination, and time window.
- The app matches drivers and riders **from the same college only**.
- Sign-in uses the user's **college email address**. Personal emails (gmail, yahoo, outlook, etc.) are rejected.
- **A user's college is worked out from their email domain. Users never type it in.** The user picks their college from a list during onboarding, and the server rejects the choice unless the email domain belongs to that college. A free-text college field is the one way to break the "same college only" rule, so it must not exist.

Main loop: Sign in with college email → finish profile (name, phone, optionally a vehicle) → post an offer or a request → see matches from your own college → request or accept a seat → once accepted, both sides see each other's phone number and exact pickup point → ride → rate each other.

---

## 2. Tech stack (use exactly this unless blocked)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui | Fast to ship; PWA, so no app-store delay |
| Backend/DB | Supabase (Postgres + **PostGIS**, Auth, Realtime, Storage, Edge Functions) | Auth, geospatial queries and row-level security in one place |
| Maps | Leaflet + OpenStreetMap tiles behind a `MapProvider` interface; geocoding behind a `Geocoder` interface (Nominatim by default, Google Places / Ola Maps can be swapped in through env vars) | Free to start, swappable later |
| Routing (optional) | OSRM or OpenRouteService behind a `Router` interface; if not configured, fall back to the straight line origin→destination | Matching still works without a paid API |
| Email | Supabase Auth for OTP; Resend for notification emails | |
| Validation | Zod on every form and server action | |
| Testing | Vitest (unit), Playwright (e2e), SQL tests for RLS (pgTAP via `supabase test db`) | |
| Deploy | Vercel + Supabase cloud | |

PWA: manifest, icons, installable, offline shell. Web push notifications are a stretch goal.

---

## 3. Authentication & college verification (most important section)

### 3.1 Sign-in flow
1. User enters an email.
2. **A server-side check runs before any OTP is sent.** Take the domain of the email and look it up in `college_domains`. The domain matches if it equals a listed domain or is a subdomain of one, compared on a dot boundary: `x@cs.iitd.ac.in` matches `iitd.ac.in`, but `x@fakeiitd.ac.in` must **not** match.
   - Not found → show "Your college isn't on CampusPool yet. Request it →" (see 3.3). **Do not send an OTP.**
   - On a blocklist of public providers (gmail.com, yahoo.*, outlook.com, hotmail.com, icloud.com, proton.me, rediffmail.com, etc.) → reject with a clear message.
3. Send a **6-digit email OTP code, not a magic link.** College mail systems often use Microsoft Defender Safe Links or similar scanners that open links in advance, which uses up a magic link before the student clicks it. Codes don't have this problem.
4. Enforce the domain rule in the database as well, using a Supabase **"Before User Created" auth hook** (or a trigger on `auth.users` if hooks aren't available) that rejects any user whose domain isn't approved. The UI check is for user experience; the database check is the real security.
5. On first sign-in, create a `profiles` row with `college_id` set automatically from the matched domain. **`college_id` cannot be edited by the user** (no RLS update policy covers it).

### 3.2 Re-verification
- Store `email_verified_at`. Require a fresh OTP every 6 months (configurable), so graduates and dropouts lose access once their college email stops working.
- A user whose re-verification is overdue can still read their history but cannot post or book.

### 3.3 Adding colleges
- `college_requests` table: requester email, college name, city, claimed domain(s), website URL.
- Admin panel (role `super_admin`) to approve a request. Approving creates the `colleges` and `college_domains` rows.
- Seed migration with a few test colleges and domains (put placeholders I can edit in `supabase/seed.sql`).

---

## 4. Data model (Postgres + PostGIS)

Use `geography(Point, 4326)` for points and `geography(LineString, 4326)` for routes. Add GIST indexes on all geography columns. All timestamps are `timestamptz`, stored in UTC and shown in IST (configurable).

```
colleges(id, name, short_name, city, campus_point geography, status['active','pending'], created_at)
college_domains(id, college_id → colleges, domain text unique)    -- e.g. 'nst.rishihood.edu.in'
college_requests(id, email, college_name, city, domains text[], website, status, created_at)

profiles(
  id uuid PK = auth.users.id,
  college_id → colleges  NOT NULL,          -- set by server only
  full_name, avatar_url, gender ['female','male','other','prefer_not'] nullable,
  role ['student','staff'] , year_or_dept text nullable,
  email_verified_at, rating_avg numeric, rating_count int,
  is_banned bool default false, created_at
)

private_contacts(                           -- separate table so RLS can hide it
  user_id PK → profiles, phone_e164 text NOT NULL, phone_verified bool default false
)

vehicles(id, owner_id → profiles, type ['car','bike'], make, model, color,
         plate_number, seats int check (seats between 1 and 7), is_active, created_at)

ride_offers(
  id, driver_id → profiles, vehicle_id → vehicles, college_id (copied from driver, trigger-enforced),
  origin_point geography, origin_label text, origin_fuzzed geography,
  dest_point geography, dest_label text,
  route geography(LineString) nullable,
  depart_at timestamptz, flex_minutes int default 15,
  seats_total int, seats_available int,
  recurring_days int[] nullable,            -- 0–6, for daily commutes
  cost_per_seat_inr int nullable,           -- cost-sharing only, see §9
  women_only bool default false,
  notes text, status ['open','full','departed','completed','cancelled'], created_at
)

ride_requests(
  id, rider_id → profiles, college_id (trigger-enforced),
  pickup_point, pickup_label, pickup_fuzzed,
  dest_point, dest_label,
  window_start timestamptz, window_end timestamptz,
  seats_needed int default 1, women_only_pref bool default false,
  recurring_days int[] nullable,
  status ['open','matched','cancelled','expired'], created_at
)

bookings(
  id, offer_id → ride_offers, request_id → ride_requests nullable,
  rider_id → profiles, driver_id → profiles, college_id,
  seats int, pickup_point, pickup_label,
  initiated_by ['rider','driver'],
  status ['pending','accepted','rejected','cancelled','completed','no_show'],
  created_at, decided_at
)

messages(id, booking_id → bookings, sender_id, body text, created_at)   -- Realtime enabled
ratings(id, booking_id, rater_id, ratee_id, stars 1–5, comment, created_at, unique(booking_id, rater_id))
reports(id, reporter_id, reported_user_id, booking_id nullable, reason, details, status, created_at)
blocks(blocker_id, blocked_id, created_at, PK(blocker_id, blocked_id))
```

**Triggers / constraints**
- `college_id` on offers, requests and bookings is set from the creator's profile by a trigger, and anything the client sends for it is ignored.
- A booking is valid only if rider, driver and offer all share one `college_id` (checked in a trigger).
- A booking is valid only if the offer's `women_only` rule is met.
- Accepting a booking lowers `seats_available` atomically, using `SELECT … FOR UPDATE` inside a Postgres function. The offer becomes `full` when seats reach 0. Cancelling gives the seat back.
- No booking between users where either has blocked the other.
- `origin_fuzzed` / `pickup_fuzzed` = the real point moved by a random 200–400 m offset, generated on insert.

---

## 5. Row-Level Security (the "same college only" guarantee)

Enable RLS on **every** table. Write a `SECURITY DEFINER` helper `auth_college_id()` that returns the caller's `profiles.college_id`.

- `profiles`: SELECT allowed when `college_id = auth_college_id()`. UPDATE only on your own row, and `college_id`, `is_banned` and `rating_*` cannot be changed (use column privileges or a trigger).
- `private_contacts`: SELECT allowed for yourself, **or** for the other party in a booking with status `accepted`/`completed`. Nobody else, including people from the same college.
- `vehicles`: same-college users can see make, model, color and seats. `plate_number` is shown only after a booking is accepted (put it in a view or column-level policy, or move it to `private_contacts`-style protection).
- `ride_offers` / `ride_requests`: SELECT where `college_id = auth_college_id()` and status is open, plus your own rows. Expose only the **fuzzed** point to others through a view (`offers_public`, `requests_public`). The exact point is visible only to the owner and to the other party in an accepted booking.
- `bookings`, `messages`: only the rider and driver on that booking.
- Banned users, and users whose re-verification is overdue, cannot INSERT anywhere.

**Required test:** a pgTAP / SQL test that signs in as a user from College A and tries to read College B's offers, requests, profiles and contacts **through the raw Supabase client**, bypassing the UI. Every attempt must return 0 rows. Also test that a same-college user with no accepted booking cannot read `private_contacts`.

---

## 6. Matching logic

A Postgres function `find_matches_for_request(request_id)` and its mirror `find_matches_for_offer(offer_id)`, called through RPC.

A candidate offer must meet all of these:
1. Same college (RLS already handles this; check again inside the function).
2. Status `open` and `seats_available >= seats_needed`.
3. Time: `depart_at` (± `flex_minutes`) overlaps `[window_start, window_end]`. For recurring rides, match on weekday and time of day.
4. Pickup is near the route: `ST_DWithin(pickup_point, COALESCE(route, ST_MakeLine(origin, dest)), pickup_radius_m)`, default 1500 m, configurable.
5. The destination is near the offer's destination (default 2 km), **or** lies further along the route than the pickup does (use `ST_LineLocatePoint` to check direction, so a rider is never matched against the direction of travel).
6. Women-only rules are respected in both directions; no blocks either way.

Rank by a score that combines (a) estimated detour = distance from pickup to route, (b) time difference, (c) driver rating. Keep the weights in one config object, and put the scoring logic in a pure TS function in `lib/matching/score.ts` with Vitest unit tests covering edge cases (opposite direction, exact time edges, 0 seats, recurring vs one-off).

When a new offer or request is created, run matching and notify the top matches (in-app plus email, rate-limited to no more than N notifications per user per hour).

---

## 7. Screens (mobile-first)

1. **Landing**: one line explaining the app and an email field.
2. **OTP entry**.
3. **Onboarding**: name, phone (E.164, Indian numbers by default), gender (optional, needed only for women-only rides), "Do you drive?" → add a vehicle. College is shown read-only ("Verified: XYZ University").
4. **Home**: two big buttons, "Offer a ride" and "Find a ride", plus "My upcoming rides".
5. **Offer a ride**: map picker plus address search for origin and destination (destination defaults to the college's `campus_point`), date/time, flexibility, seats, vehicle, recurring days, cost per seat (optional), women-only toggle, notes.
6. **Find a ride**: same pickup/destination/time inputs → match list (cards showing driver first name, rating, vehicle model and color, approximate pickup distance, time) plus a map view with **fuzzed** markers only.
7. **Ride detail**: request a seat / accept a rider. After acceptance: phone number with tap-to-call and WhatsApp deep link (`https://wa.me/<number>`), exact pickup on the map, plate number, chat.
8. **Chat** (Supabase Realtime) for each booking.
9. **My rides**: upcoming, past, pending requests; cancel, mark completed, mark no-show.
10. **Rate** after completion.
11. **Profile / settings**: edit details, manage vehicles, blocked users, delete account (hard delete of personal data, keeping anonymized ride records).
12. **Safety**: "Share trip" button that copies a message with driver name, vehicle, plate and pickup time for sending to a friend; report user; SOS button that dials 112.
13. **Admin**: approve college requests, review reports, ban users.

UI: clean, high contrast, works one-handed. Every form uses Zod validation with inline errors. Loading and empty states on every list.

---

## 8. Privacy & abuse rules (do not skip)

- Phone numbers, exact locations and plate numbers are **never** included in a list or search response. They appear only after a booking is accepted. Enforce this in RLS and views, not just by hiding them in the UI.
- Rate limits: OTP sends (per email and per IP), offer/request creation (e.g. 10 a day), booking requests (e.g. 20 a day), messages.
- A user who gets 3 or more open reports is automatically blocked from posting until an admin reviews them.
- Store no location history beyond what each ride needs; expired requests are cleaned up after 30 days (`pg_cron`).
- Store and display a Terms + Privacy page, with a checkbox to accept at onboarding.

---

## 9. Cost-sharing note (product rule)

`cost_per_seat_inr` is a **fuel-cost split**, not a fare. Cap it (configurable, e.g. ₹ per km × distance / seats), and show the copy "Cost-sharing only — no profit rides". No in-app payments in v1; riders pay drivers directly through UPI. Carrying paying passengers for profit in a private car is legally risky in India, so the product must not look like a taxi service.

---

## 10. Project structure

```
/app                 Next.js routes (auth, onboarding, offer, find, rides, chat, admin)
/components          UI components (shadcn based)
/lib/supabase        server + browser clients, typed (generate types from DB)
/lib/matching        scoring, pure functions + tests
/lib/geo             MapProvider, Geocoder, Router interfaces + implementations
/lib/validation      Zod schemas shared by client & server
/supabase/migrations SQL migrations (schema, RLS, functions, triggers)
/supabase/seed.sql   test colleges, domains, users, rides
/supabase/tests      pgTAP RLS + function tests
/e2e                 Playwright tests
```

All writes go through **server actions or RPCs**. The client never inserts directly into tables that have triggers it could get around.

---

## 11. Milestones (build in this order; stop and show me after each)

1. **Scaffold**: Next.js, Tailwind, shadcn, Supabase local (`supabase start`), PostGIS enabled, CI script (`lint`, `typecheck`, `test`).
2. **Auth & colleges**: domain check, OTP, auth hook, onboarding, `college_id` auto-assigned, college request flow. Plus RLS tests showing cross-college isolation.
3. **Vehicles + offers + requests**: CRUD, map picker, geocoding, fuzzing, public views.
4. **Matching**: SQL functions, TS scoring, unit tests, match list and map.
5. **Bookings**: request/accept/reject/cancel, atomic seat handling, contact reveal, chat.
6. **Safety & ratings**: share trip, report, block, SOS, ratings, admin panel.
7. **Notifications & PWA**: emails, in-app notifications, installable PWA.
8. **Hardening**: rate limits, re-verification, cleanup jobs, Playwright e2e for the full flow (two users from the same college complete a ride; a third user from another college sees nothing).
9. **Deploy**: Vercel + Supabase cloud, environment variable docs, README with setup steps.

---

## 12. Working rules for Claude Code

- **Start in plan mode.** Read this spec, then give me: (a) your implementation plan per milestone, (b) any spec conflicts or risks you see, and (c) the inputs you need from me: Supabase project URL/keys, Resend key, map/geocoding provider choice, and the real college names and domains to seed.
- Do one milestone at a time. At the end of each: run lint, typecheck and all tests, fix any failures, commit with a clear message, then summarize what was built and how to try it.
- Never weaken RLS or move a security check into the client just to get something working. If something is blocked, stop and tell me.
- Generate Supabase TypeScript types after every migration and use them everywhere; no `any`.
- Keep secrets in `.env.local`; commit a complete `.env.example`.
- When unsure about a product decision, choose the option that is **more private and safer** for users, and list the decision in the milestone summary.
- Write a `README.md` covering local setup, how to add a college, how to run tests, and how to deploy.
