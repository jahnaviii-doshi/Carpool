-- Local development seed data. Runs after migrations on `supabase db reset`.
-- Not applied to Supabase cloud. Edit freely.
--
-- The real first college (American University of Sharjah, aus.edu) is in
-- migration 20261116010200_seed_aus.sql so it also exists in production.

-- A second college so cross-college isolation can be tried by hand:
-- sign in as someone@aus.edu in one browser and someone@testcollege.example
-- in another (OTP emails land in Mailpit: http://127.0.0.1:54324).
with c as (
  insert into public.colleges (name, short_name, city, country_code, campus_point)
  values (
    'Test College (local only)', 'TEST', 'Dubai', 'AE',
    extensions.st_setsrid(extensions.st_makepoint(55.4170, 25.1240), 4326)::extensions.geography
  )
  returning id
)
insert into public.college_domains (college_id, domain)
select id, 'testcollege.example' from c;

-- A pending college request so the admin panel has something to review.
insert into public.college_requests (email, college_name, city, domains, website)
values ('someone@uos.example', 'University of Sharjah (example request)', 'Sharjah',
        array['uos.example']::public.dns_name[], 'https://www.sharjah.ac.ae');
