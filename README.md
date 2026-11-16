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
pnpm ci            # lint + typecheck + unit + db tests
```

To use an already-installed Chromium for Playwright, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome`.

## Region defaults (UAE)

The first college is the **American University of Sharjah** (`aus.edu`,
University City, Sharjah), so region defaults live in `lib/config/region.ts`
and are set for the UAE: times shown in `Asia/Dubai`, phone numbers default to
`+971`, the SOS button dials **999**, and currency is AED. Set
`NEXT_PUBLIC_REGION=IN` for the India defaults from the original spec.

**Cost-sharing is off for the UAE.** Carrying passengers for money in a
private car counts as illegal passenger transport in the UAE, so the
cost-per-seat field is hidden unless the region enables it.

## Adding a college

Arrives in Milestone 2 (admin approval of `college_requests`, plus
`supabase/seed.sql` for local data).

## Deploy

Arrives in Milestone 9 (Vercel + Supabase cloud).
