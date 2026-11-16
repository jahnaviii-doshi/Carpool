-- Run with: pnpm test:db   (wraps `supabase test db`)
begin;
select plan(5);

select has_extension('postgis', 'PostGIS is installed');
select has_extension('pg_cron', 'pg_cron is installed');
select has_extension('citext', 'citext is installed');

-- Geography maths works and is in metres: AUS main gate -> Sharjah City Centre
-- is roughly 5–6 km as the crow flies.
select ok(
  extensions.st_distance(
    extensions.st_makepoint(55.4807, 25.3109)::extensions.geography,
    extensions.st_makepoint(55.4319, 25.3255)::extensions.geography
  ) between 4500 and 6500,
  'ST_Distance on geography returns metres'
);

select ok(
  extensions.st_dwithin(
    extensions.st_makepoint(55.4807, 25.3109)::extensions.geography,
    extensions.st_makepoint(55.4820, 25.3115)::extensions.geography,
    1500
  ),
  'ST_DWithin on geography uses a metre radius'
);

select * from finish();
rollback;
