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

## Region defaults (UAE)

The first college is the **American University of Sharjah** (`aus.edu`,
University City, Sharjah), so region defaults live in `lib/config/region.ts`
and are set for the UAE: times shown in `Asia/Dubai`, phone numbers default to
`+971`, the SOS button dials **999**, and currency is AED. Set
`NEXT_PUBLIC_REGION=IN` for the India defaults from the original spec.

**Cost-sharing is off for the UAE.** Carrying passengers for money in a
private car counts as illegal passenger transport in the UAE, so the
cost-per-seat field is hidden unless the region enables it.

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
