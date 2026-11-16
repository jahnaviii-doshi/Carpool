begin;
\ir _helpers.psql
select plan(21);

create temp table ids as
select pg_temp.create_user('fresh@aus.edu') as u,
       pg_temp.create_onboarded_user('done@aus.edu', '+971504444444', 'Sara Ahmed') as d;
grant select on ids to authenticated;

-- ---- record_email_verification ---------------------------------------------
select pg_temp.login_as((select u from ids), now() - interval '1 minute');
select throws_ok(
  $$ select public.complete_onboarding('Fresh User', '+971505555555', 'student', null, null, true) $$,
  '42501', null, 'onboarding is refused before the email is verified');
select isnt(public.record_email_verification(), null, 'record_email_verification stores the OTP time');
select ok(
  (select email_verified_at between now() - interval '2 minutes' and now() from public.profiles),
  'email_verified_at comes from the JWT amr timestamp');

-- A session without an OTP amr entry cannot record a verification.
select set_config('request.jwt.claims',
  json_build_object('sub', (select u from ids), 'role', 'authenticated',
                    'amr', json_build_array(json_build_object('method', 'password', 'timestamp', 1)))::text,
  true);
select throws_ok($$ select public.record_email_verification() $$, '42501', null,
  'a password session cannot record an email verification');
select pg_temp.login_as((select u from ids));

-- ---- complete_onboarding validation ----------------------------------------
select throws_ok(
  $$ select public.complete_onboarding('Fresh User', '+971505555555', 'student', 'female', null, false) $$,
  '22023', null, 'terms must be accepted');
select throws_ok(
  $$ select public.complete_onboarding('Fresh User', '0505555555', 'student', 'female', null, true) $$,
  '22023', null, 'phone must be E.164');
select throws_ok(
  $$ select public.complete_onboarding('  ', '+971505555555', 'student', 'female', null, true) $$,
  '22023', null, 'name is required');
select lives_ok(
  $$ select public.complete_onboarding('Fresh User', '+971505555555', 'student', 'female', 'CS, year 2', true) $$,
  'valid onboarding succeeds');
select is((select gender::text from public.profiles), 'female', 'gender is stored');
select isnt((select onboarded_at from public.profiles), null, 'onboarded_at is set');
select is((select phone_e164 from public.private_contacts), '+971505555555', 'phone is stored privately');
select ok(public.can_write(), 'a verified, onboarded user can write');

-- Gender is set-once: a second onboarding call keeps the original value.
select lives_ok(
  $$ select public.complete_onboarding('Fresh User', '+971505555555', 'student', 'male', null, true) $$,
  'onboarding can be re-run to edit details');
select is((select gender::text from public.profiles), 'female', 'gender cannot be changed once set');

-- ---- Column protection on direct updates -----------------------------------
select lives_ok($$ update public.profiles set full_name = 'Renamed' $$, 'user can rename themselves');
select throws_ok($$ update public.profiles set college_id = gen_random_uuid() $$, '42501', null,
  'user cannot change college_id');
select throws_ok($$ update public.profiles set is_banned = false $$, '42501', null,
  'user cannot change is_banned');
select throws_ok($$ update public.profiles set rating_avg = 5 $$, '42501', null,
  'user cannot change rating_avg');
select throws_ok($$ update public.profiles set email_verified_at = now() $$, '42501', null,
  'user cannot set email_verified_at directly');

-- ---- can_write: banned and overdue users ----------------------------------
select pg_temp.logout();
update public.profiles set email_verified_at = now() - interval '181 days' where id = (select d from ids);
select pg_temp.login_as((select d from ids));
select ok(not public.can_write(), 'a user overdue for re-verification cannot write');

select pg_temp.logout();
update public.profiles set email_verified_at = now(), is_banned = true where id = (select d from ids);
select pg_temp.login_as((select d from ids));
select ok(not public.can_write(), 'a banned user cannot write');

select pg_temp.logout();
select * from finish();
rollback;
