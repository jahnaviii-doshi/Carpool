begin;
\ir _helpers.psql
select plan(13);

create temp table ids as
select pg_temp.create_onboarded_user('admin@aus.edu', '+971506666666', 'Admin Person') as admin,
       pg_temp.create_onboarded_user('student@aus.edu', '+971507777777', 'Normal Student') as student;
grant select on ids to anon, authenticated;
insert into public.super_admins (email) values ('admin@aus.edu');

-- ---- Submitting (anonymous) --------------------------------------------------
select pg_temp.login_anon();
select lives_ok(
  $$ select public.submit_college_request('dean@newuni.test', 'New University', 'Ajman',
       array['newuni.test'], 'https://newuni.test') $$,
  'anon can request a college');
select throws_ok(
  $$ select public.submit_college_request('me@gmail.com', 'Gmail U', 'X', array['gmail.com']) $$,
  '22023', null, 'a public provider cannot be claimed as a college domain');
select throws_ok(
  $$ select public.submit_college_request('me@other.test', 'Mismatch U', 'X', array['newuni2.test']) $$,
  '22023', null, 'requester email must be at a claimed domain');
select throws_ok(
  $$ select public.submit_college_request('x@aus.edu', 'AUS again', 'Sharjah', array['aus.edu']) $$,
  '22023', null, 'an existing college cannot be requested again');
select lives_ok(
  $$ select public.submit_college_request('dean@newuni.test', 'New University', 'Ajman', array['newuni.test']) $$,
  'second request from the same email is allowed');
select lives_ok(
  $$ select public.submit_college_request('dean@newuni.test', 'New University', 'Ajman', array['newuni.test']) $$,
  'third request from the same email is allowed');
select throws_ok(
  $$ select public.submit_college_request('dean@newuni.test', 'New University', 'Ajman', array['newuni.test']) $$,
  '54000', null, 'a fourth request in one day is rate-limited');

-- ---- Approving -----------------------------------------------------------------
select pg_temp.login_as((select student from ids));
select throws_ok(
  $$ select public.approve_college_request(
       (select id from public.college_requests limit 1), 'X', 'X', 'X', array['newuni.test']) $$,
  '42501', null, 'a normal user cannot approve a request');

select pg_temp.login_as((select admin from ids));
select ok(public.is_super_admin(), 'listed admin is a super admin');
select ok(
  (select count(*) from public.college_requests where email = 'dean@newuni.test') = 3,
  'super admin can read requests');
select lives_ok(
  $$ select public.approve_college_request(
       (select id from public.college_requests where email = 'dean@newuni.test' order by created_at limit 1),
       'New University', 'NU', 'Ajman', array['newuni.test', 'staff.newuni.test'], 55.5, 25.4) $$,
  'super admin approves a request');

select pg_temp.logout();
select isnt(public.college_for_email('someone@newuni.test'), null,
  'the approved domain now maps to the new college');
select is(
  public.hook_before_user_created('{"user":{"email":"someone@newuni.test"}}'),
  '{}'::jsonb, 'sign-up is now allowed for the new college');

select * from finish();
rollback;
