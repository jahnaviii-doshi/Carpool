-- REQUIRED by spec §5: a College A user, using the API role directly (no UI),
-- tries to read College B's data. Every attempt must return 0 rows. Also: a
-- same-college user with no accepted booking cannot read private_contacts.
--
-- Offers and requests are added in Milestone 3; their isolation tests will
-- be added to this file then.
begin;
\ir _helpers.psql
select plan(19);

create temp table ids as
select
  pg_temp.create_onboarded_user('a1@aus.edu', '+971501111111', 'Aisha Khan') as a1,
  pg_temp.create_onboarded_user('a2@aus.edu', '+971502222222', 'Omar Ali') as a2,
  pg_temp.create_onboarded_user('b1@collegeb.test', '+971503333333', 'Bilal Noor') as b1,
  pg_temp.create_user('a3unverified@aus.edu') as a3;
grant select on ids to anon, authenticated;

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
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.profiles_public $$, '42501', null, 'anon cannot read profiles_public');
select throws_ok($$ select * from public.private_contacts $$, '42501', null, 'anon cannot read private_contacts');
select ok((select count(*) from public.colleges) >= 1, 'anon can list active colleges (public)');

select pg_temp.logout();
select * from finish();
rollback;
