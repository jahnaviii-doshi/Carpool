-- Production college data. Runs on every environment, including Supabase
-- cloud. Local-only test colleges live in supabase/seed.sql.
--
-- American University of Sharjah — University City, Sharjah, UAE.
-- Students and staff both use @aus.edu. Campus point is approximate (main
-- campus, University City); refine it from the admin panel if needed.

with c as (
  insert into public.colleges (name, short_name, city, country_code, campus_point)
  values (
    'American University of Sharjah', 'AUS', 'Sharjah', 'AE',
    extensions.st_setsrid(extensions.st_makepoint(55.4905, 25.3120), 4326)::extensions.geography
  )
  returning id
)
insert into public.college_domains (college_id, domain)
select id, 'aus.edu' from c;
