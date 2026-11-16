-- REQUIRED by spec §5: a College A user, using the API role directly (no UI),
-- tries to read College B's data. Every attempt must return 0 rows. Also: a
-- same-college user with no accepted booking cannot read private_contacts.
--
begin;
\ir _helpers.psql
select plan(33);

create temp table ids as
select
  pg_temp.create_onboarded_user('a1@aus.edu', '+971501111111', 'Aisha Khan') as a1,
  pg_temp.create_onboarded_user('a2@aus.edu', '+971502222222', 'Omar Ali') as a2,
  pg_temp.create_onboarded_user('b1@collegeb.test', '+971503333333', 'Bilal Noor') as b1,
  pg_temp.create_user('a3unverified@aus.edu') as a3;
grant select on ids to anon, authenticated;

create temp table rides as
select pg_temp.post_offer((select b1 from ids)) as b_offer,
       pg_temp.post_request((select b1 from ids)) as b_request,
       pg_temp.post_offer((select a2 from ids)) as a2_offer,
       pg_temp.post_request((select a2 from ids)) as a2_request;
grant select on rides to anon, authenticated;

-- ---- As A1 (AUS) ------------------------------------------------------------
select pg_temp.login_as((select a1 from ids));

select is((select count(*)::int from public.profiles), 1,
  'A1 reads exactly one row from profiles (their own)');
select is((select count(*)::int from public.profiles where id = (select b1 from ids)), 0,
  'A1 cannot read College B profile from the base table');
select is((select count(*)::int from public.profiles where id = (select a2 from ids)), 0,
  'A1 cannot read another AUS profile from the base table either');

select is((select count(*)::int from public.profiles_public where id = (select b1 from ids)), 0,
  'A1 cannot see College B profile through profiles_public');
select is((select count(*)::int from public.profiles_public where id = (select a2 from ids)), 1,
  'A1 can see a same-college profile through profiles_public');
select is((select first_name from public.profiles_public where id = (select a2 from ids)), 'Omar',
  'profiles_public exposes first name only');
select is(
  (select count(*)::int from public.profiles_public
   where college_id <> (select college_id from public.profiles where id = (select a1 from ids))),
  0, 'profiles_public never returns another college');

select is((select count(*)::int from public.private_contacts), 1,
  'A1 reads exactly one private_contacts row (their own)');
select is((select count(*)::int from public.private_contacts where user_id = (select b1 from ids)), 0,
  'A1 cannot read College B phone number');
select is((select count(*)::int from public.private_contacts where user_id = (select a2 from ids)), 0,
  'A1 cannot read a same-college phone number without an accepted booking');

select is((select count(*)::int from public.college_requests), 0,
  'a normal user cannot read college requests');
select is((select count(*)::int from public.college_domains), 0,
  'a normal user cannot list college domains');
select throws_ok($$ select * from public.super_admins $$, '42501', null,
  'super_admins is not readable');

-- Offers and requests: College B is invisible everywhere.
select is((select count(*)::int from public.ride_offers where id = (select b_offer from rides)), 0,
  'A1 cannot read College B offer from the base table');
select is((select count(*)::int from public.offers_public where id = (select b_offer from rides)), 0,
  'A1 cannot read College B offer from offers_public');
select is((select count(*)::int from public.ride_requests where id = (select b_request from rides)), 0,
  'A1 cannot read College B request from the base table');
select is((select count(*)::int from public.requests_public where id = (select b_request from rides)), 0,
  'A1 cannot read College B request from requests_public');
select is((select count(*)::int from public.my_offers where id = (select b_offer from rides)), 0,
  'A1 cannot read College B offer through my_offers');
select is((select count(*)::int from public.vehicles where owner_id = (select b1 from ids)), 0,
  'A1 cannot read College B vehicles');
select is((select count(*)::int from public.vehicle_plates), 0,
  'A1 (no vehicle of their own) reads no number plates');

-- Same college: visible only through the fuzzed public views.
select is((select count(*)::int from public.ride_offers where id = (select a2_offer from rides)), 0,
  'A1 cannot read a same-college offer from the base table (exact points)');
select is((select count(*)::int from public.offers_public where id = (select a2_offer from rides)), 1,
  'A1 sees a same-college offer through offers_public');
select is((select count(*)::int from public.requests_public where id = (select a2_request from rides)), 1,
  'A1 sees a same-college request through requests_public');
select is((select count(*)::int from public.vehicle_plates p join public.vehicles v on v.id = p.vehicle_id
           where v.owner_id = (select a2 from ids)), 0,
  'A1 cannot read a same-college number plate');
select is(
  (select count(*)::int from public.offers_public
   where college_id <> (select college_id from public.profiles where id = (select a1 from ids))),
  0, 'offers_public never returns another college');

-- ---- As B1 (College B): mirror check ---------------------------------------
select pg_temp.login_as((select b1 from ids));
select is(
  (select count(*)::int from public.profiles_public where id in (select a1 from ids union select a2 from ids)),
  0, 'B1 cannot see AUS profiles');

-- ---- As A3 (AUS, never verified by OTP) ------------------------------------
select pg_temp.login_as((select a3 from ids));
select is((select count(*)::int from public.profiles_public), 0,
  'a user who never verified by OTP sees no one');

-- ---- Anonymous --------------------------------------------------------------
select pg_temp.login_anon();
select throws_ok($$ select * from public.offers_public $$, '42501', null, 'anon cannot read offers_public');
select throws_ok($$ select * from public.ride_offers $$, '42501', null, 'anon cannot read ride_offers');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.profiles_public $$, '42501', null, 'anon cannot read profiles_public');
select throws_ok($$ select * from public.private_contacts $$, '42501', null, 'anon cannot read private_contacts');
select ok((select count(*) from public.colleges) >= 1, 'anon can list active colleges (public)');

select pg_temp.logout();
select * from finish();
rollback;
