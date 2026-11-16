-- Matching rules (spec §6). The driver's route is the straight line
-- Al Nahda (55.3700, 25.3050) → AUS (55.4905, 25.3120), about 12 km.
begin;
\ir _helpers.psql
select plan(26);

create temp table u as
select pg_temp.create_onboarded_user('drv@aus.edu', '+971501200001', 'Dana Driver') as drv,
       pg_temp.create_onboarded_user('rid@aus.edu', '+971501200002', 'Rami Rider') as rid,
       pg_temp.create_onboarded_user('fem@aus.edu', '+971501200003', 'Fatima Rider') as fem,
       pg_temp.create_onboarded_user('fdrv@aus.edu', '+971501200004', 'Farah Driver') as fdrv,
       pg_temp.create_onboarded_user('other@collegeb.test', '+971501200005', 'Bilal Other') as other;
update public.profiles set gender = 'female' where id in ((select fem from u), (select fdrv from u));
update public.profiles set gender = 'male' where id in ((select drv from u), (select rid from u));
grant select on u to authenticated;

-- Tomorrow 08:00 Dubai, as a timestamptz.
create temp table t as
select (((now() at time zone 'Asia/Dubai')::date + 1) + time '08:00') at time zone 'Asia/Dubai' as at8;
grant select on t to authenticated;

create temp table o as
select pg_temp.raw_offer((select drv from u), 55.3700, 25.3050, 55.4905, 25.3120, (select at8 from t), 2, 15) as main;
grant select on o to authenticated;

-- Helper: does request `rq` (owned by `who`) match the main offer?
create function pg_temp.matches(who uuid, rq uuid) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.login_as(who);
  select exists (select 1 from public.find_matches_for_request(rq) m where m.offer_id = (select main from o)) into v;
  perform pg_temp.logout();
  return v;
end $$;

-- ---- Rule 4: pickup near the route -------------------------------------------
-- 40% along the line, ~500 m off it.
select ok(pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3123, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'pickup on the way to campus matches');

select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4164, 25.1278, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'pickup 20 km off the route does not match');

-- ---- Rule 5: direction ---------------------------------------------------------
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4800, 25.3115, 55.3710, 25.3055,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'opposite direction (campus → Al Nahda) does not match');

select ok(pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4062, 25.3071, 55.4544, 25.3099,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'drop-off further along the route (30% → 70%) matches');

select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4544, 25.3099, 55.4062, 25.3071,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'drop-off behind the pickup (70% → 30%) does not match');

-- ---- Rule 3: time, with exact edges -------------------------------------------
-- Offer departs 08:00 ± 15. A window ending exactly at 07:45 touches it.
select ok(pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '75 minutes', (select at8 from t) - interval '15 minutes')),
  'window ending exactly at depart − flex matches (inclusive edge)');
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '75 minutes', (select at8 from t) - interval '16 minutes')),
  'window ending one minute earlier does not match');
select ok(pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) + interval '15 minutes', (select at8 from t) + interval '60 minutes')),
  'window starting exactly at depart + flex matches');
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) + interval '16 minutes', (select at8 from t) + interval '60 minutes')),
  'window starting one minute later does not match');

-- ---- Rule 2: seats --------------------------------------------------------------
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes', 3)),
  'needing 3 seats when 2 are free does not match');
update public.ride_offers set seats_available = 0, status = 'full' where id = (select main from o);
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'a full offer (0 seats) does not match');
update public.ride_offers set seats_available = 2, status = 'open' where id = (select main from o);

-- ---- Rule 6: women-only and blocks -----------------------------------------------
create temp table w as
select pg_temp.raw_offer((select fdrv from u), 55.3700, 25.3050, 55.4905, 25.3120, (select at8 from t), 2, 15, true) as wo;
grant select on w to authenticated;
create function pg_temp.matches_offer(who uuid, rq uuid, offer uuid) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.login_as(who);
  select exists (select 1 from public.find_matches_for_request(rq) m where m.offer_id = offer) into v;
  perform pg_temp.logout();
  return v;
end $$;

select ok(not pg_temp.matches_offer((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes'),
  (select wo from w)), 'a women-only ride is not offered to a man');
select ok(pg_temp.matches_offer((select fem from u),
  pg_temp.raw_request((select fem from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes'),
  (select wo from w)), 'a women-only ride is offered to a woman');
select ok(not pg_temp.matches((select fem from u),
  pg_temp.raw_request((select fem from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes', 1, true)),
  'a rider who wants women drivers is not matched with a male driver');

insert into public.blocks (blocker_id, blocked_id) values ((select rid from u), (select drv from u));
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'no match when the rider blocked the driver');
delete from public.blocks;
insert into public.blocks (blocker_id, blocked_id) values ((select drv from u), (select rid from u));
select ok(not pg_temp.matches((select rid from u),
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'no match when the driver blocked the rider');
delete from public.blocks;

-- ---- Rule 1: same college only ------------------------------------------------
select ok(not pg_temp.matches((select other from u),
  pg_temp.raw_request((select other from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes')),
  'a rider from another college never sees the offer');

-- Only the owner can run matching for a request.
create temp table someone as
select pg_temp.raw_request((select fem from u), 55.4182, 25.3080, 55.4905, 25.3120,
  (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes') as rq;
grant select on someone to authenticated;
select pg_temp.login_as((select rid from u));
select throws_ok($$ select * from public.find_matches_for_request((select rq from someone)) $$,
  'P0002', null, 'cannot run matching on someone else''s request');
select pg_temp.logout();

-- ---- Output: rounded, fuzzed ------------------------------------------------
create temp table rq_out as
select pg_temp.raw_request((select rid from u), 55.4182, 25.3123, 55.4905, 25.3120,
  (select at8 from t) - interval '45 minutes', (select at8 from t) - interval '5 minutes') as id;
grant select on rq_out to authenticated;
select pg_temp.login_as((select rid from u));
create temp table res as
select * from public.find_matches_for_request((select id from rq_out));
select is((select detour_m % 500 from res where offer_id = (select main from o)), 0,
  'detour is rounded to 500 m');
select is((select time_gap_minutes from res where offer_id = (select main from o)), 5,
  'time gap is how far the departure is outside the window');
select ok(
  (select extensions.st_distance(
     extensions.st_makepoint(origin_lng, origin_lat)::extensions.geography,
     extensions.st_makepoint(55.37, 25.305)::extensions.geography) between 199 and 401
   from res where offer_id = (select main from o)),
  'match shows the fuzzed origin, not the real one');
select pg_temp.logout();

-- ---- Recurring vs one-off ----------------------------------------------------
-- A Mon–Fri 07:30–08:30 request template matches dated offers on weekdays only.
create temp table weekly as
select
  pg_temp.raw_offer((select drv from u), 55.3700, 25.3050, 55.4905, 25.3120,
    ((d::date + time '08:00') at time zone 'Asia/Dubai')) as id,
  extract(dow from d::date)::int as dow
from generate_series((now() at time zone 'Asia/Dubai')::date + 2, (now() at time zone 'Asia/Dubai')::date + 8, interval '1 day') d;
grant select on weekly to authenticated;

create temp table tmpl as
select pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
  (((now() at time zone 'Asia/Dubai')::date + 1) + time '07:30') at time zone 'Asia/Dubai',
  (((now() at time zone 'Asia/Dubai')::date + 1) + time '08:30') at time zone 'Asia/Dubai',
  1, false, array[1, 2, 3, 4, 5]) as id;
grant select on tmpl to authenticated;

select pg_temp.login_as((select rid from u));
select is(
  (select count(*)::int from public.find_matches_for_request((select id from tmpl)) m
   join weekly w on w.id = m.offer_id),
  (select count(*)::int from weekly where dow between 1 and 5),
  'a weekday template request matches each weekday dated offer');
select is(
  (select count(*)::int from public.find_matches_for_request((select id from tmpl)) m
   join weekly w on w.id = m.offer_id where w.dow in (0, 6)),
  0, 'and no weekend offers');
select pg_temp.logout();

-- ---- Mirror: riders for an offer ----------------------------------------------
create temp table mirror as
select
  pg_temp.raw_request((select rid from u), 55.4182, 25.3080, 55.4905, 25.3120,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes') as on_route,
  pg_temp.raw_request((select fem from u), 55.4800, 25.3115, 55.3710, 25.3055,
    (select at8 from t) - interval '30 minutes', (select at8 from t) + interval '30 minutes') as opposite;
grant select on mirror to authenticated;
select pg_temp.login_as((select drv from u));
select ok(exists (select 1 from public.find_matches_for_offer((select main from o)) m
                  where m.request_id = (select on_route from mirror)),
  'driver sees the on-route rider');
select ok(not exists (select 1 from public.find_matches_for_offer((select main from o)) m
                      where m.request_id = (select opposite from mirror)),
  'driver does not see the rider going the other way');
select throws_ok($$ select * from public.find_matches_for_offer((select wo from w)) $$, 'P0002', null,
  'cannot run matching on someone else''s offer');

select pg_temp.logout();
select * from finish();
rollback;
