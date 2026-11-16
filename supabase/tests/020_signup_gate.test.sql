begin;
\ir _helpers.psql
select plan(11);

-- Layer 1: the Before User Created hook --------------------------------------
select is(
  public.hook_before_user_created('{"user":{"email":"g00012345@aus.edu"}}'),
  '{}'::jsonb,
  'hook allows an aus.edu address'
);
select is(
  public.hook_before_user_created('{"user":{"email":"someone@gmail.com"}}') -> 'error' ->> 'http_code',
  '403',
  'hook rejects gmail with 403'
);
select is(
  public.hook_before_user_created('{"user":{"email":"x@fakeaus.edu"}}') -> 'error' ->> 'http_code',
  '403',
  'hook rejects a look-alike domain'
);
select is(
  public.hook_before_user_created('{"user":{"phone":"+971500000000"}}') -> 'error' ->> 'http_code',
  '403',
  'hook rejects a sign-up with no email'
);

-- Layer 2: triggers on auth.users --------------------------------------------
select throws_ok(
  $$ select pg_temp.create_user('someone@gmail.com') $$,
  '42501', null,
  'auth.users insert with gmail is rejected even without the hook'
);
select throws_ok(
  $$ select pg_temp.create_user('x@fakeaus.edu') $$,
  '42501', null,
  'auth.users insert with a look-alike domain is rejected'
);

select lives_ok(
  $$ select pg_temp.create_user('newstudent@aus.edu') $$,
  'auth.users insert with aus.edu succeeds'
);
select is(
  (select p.college_id from public.profiles p join auth.users u on u.id = p.id
   where u.email = 'newstudent@aus.edu'),
  (select id from public.colleges where short_name = 'AUS'),
  'profile is created with college_id set from the email domain'
);
select is(
  (select p.email_verified_at from public.profiles p join auth.users u on u.id = p.id
   where u.email = 'newstudent@aus.edu'),
  null,
  'a new profile is not verified until an OTP is recorded'
);

-- Email changes may not move a user to another college.
select throws_ok(
  $$ update auth.users set email = 'newstudent@collegeb.test' where email = 'newstudent@aus.edu' $$,
  '42501', null,
  'changing email to another college is rejected'
);
select lives_ok(
  $$ update auth.users set email = 'newstudent@cs.aus.edu' where email = 'newstudent@aus.edu' $$,
  'changing email within the same college is allowed'
);

select * from finish();
rollback;
