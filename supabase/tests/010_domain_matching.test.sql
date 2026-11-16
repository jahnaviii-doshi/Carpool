begin;
\ir _helpers.psql
select plan(26);

-- email_domain ---------------------------------------------------------------
select is(public.email_domain('Student@AUS.edu'), 'aus.edu', 'domain is lower-cased');
select is(public.email_domain('  g00012345@aus.edu  '), 'aus.edu', 'whitespace is trimmed');
select is(public.email_domain('x@cs.aus.edu.'), 'cs.aus.edu', 'trailing dot is removed');
select is(public.email_domain('not-an-email'), null, 'no @ is invalid');
select is(public.email_domain('a@b@aus.edu'), null, 'two @ is invalid');
select is(public.email_domain('x@localhost'), null, 'single-label domain is invalid');

-- domain_matches (dot boundary) ---------------------------------------------
select ok(public.domain_matches('aus.edu', 'aus.edu'), 'exact domain matches');
select ok(public.domain_matches('cs.aus.edu', 'aus.edu'), 'subdomain matches');
select ok(public.domain_matches('a.b.aus.edu', 'aus.edu'), 'deep subdomain matches');
select ok(not public.domain_matches('fakeaus.edu', 'aus.edu'), 'fakeaus.edu does not match aus.edu');
select ok(not public.domain_matches('aus.edu.evil.com', 'aus.edu'), 'aus.edu.evil.com does not match');
select ok(not public.domain_matches('edu', 'aus.edu'), 'parent of domain does not match');

-- blocklist -------------------------------------------------------------------
select ok(public.is_blocked_email_domain('gmail.com'), 'gmail.com is blocked');
select ok(public.is_blocked_email_domain('yahoo.co.in'), 'yahoo.* is blocked (co.in)');
select ok(public.is_blocked_email_domain('yahoo.com'), 'yahoo.* is blocked (com)');
select ok(public.is_blocked_email_domain('outlook.ae'), 'outlook.* is blocked');
select ok(public.is_blocked_email_domain('proton.me'), 'proton.me is blocked');
select ok(not public.is_blocked_email_domain('aus.edu'), 'aus.edu is not blocked');
select ok(not public.is_blocked_email_domain('notyahoo.com'), 'notyahoo.com is not blocked');

-- college_for_email -------------------------------------------------------------
select is(
  public.college_for_email('g00012345@aus.edu'),
  (select id from public.colleges where short_name = 'AUS'),
  'aus.edu maps to American University of Sharjah'
);
select is(
  public.college_for_email('prof@cs.aus.edu'),
  (select id from public.colleges where short_name = 'AUS'),
  'cs.aus.edu maps to AUS'
);
select is(public.college_for_email('x@fakeaus.edu'), null, 'fakeaus.edu maps to no college');

-- check_signup_email (pre-OTP screen) --------------------------------------------
select is(public.check_signup_email('x@aus.edu') ->> 'status', 'ok', 'aus.edu is ok');
select is(public.check_signup_email('x@gmail.com') ->> 'status', 'public_provider', 'gmail is public_provider');
select is(public.check_signup_email('x@fakeaus.edu') ->> 'status', 'unknown_college', 'unknown domain');
select is(public.check_signup_email('nonsense') ->> 'status', 'invalid', 'garbage is invalid');

select * from finish();
rollback;
