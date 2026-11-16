-- Milestone 2b: profiles, private contacts, the sign-up gate (auth hook +
-- auth.users triggers), RLS, onboarding / verification RPCs, college
-- requests and super-admin approval.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'staff');
create type public.gender as enum ('female', 'male', 'other', 'prefer_not');
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Set by the server from the email domain. No API role can write it.
  college_id uuid not null references public.colleges (id),
  full_name text check (char_length(btrim(full_name)) between 1 and 100),
  avatar_url text check (avatar_url ~ '^https://'),
  gender public.gender,
  role public.user_role,
  year_or_dept text check (char_length(year_or_dept) <= 100),
  -- Last time the user proved control of their college inbox with an OTP.
  email_verified_at timestamptz,
  terms_accepted_at timestamptz,
  onboarded_at timestamptz,
  rating_avg numeric(3, 2) check (rating_avg between 1 and 5),
  rating_count int not null default 0 check (rating_count >= 0),
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_college_id_idx on public.profiles (college_id);

-- Kept apart from profiles so RLS can hide it from everyone except the owner
-- (and, from Milestone 5, the other party of an accepted booking).
create table public.private_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified boolean not null default false
);

-- Super admins are listed by email so the first one can be granted before
-- they ever sign in. Grant with `pnpm admin:grant <email>` (not committed).
create table public.super_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.college_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  college_name text not null check (char_length(btrim(college_name)) between 2 and 200),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  domains public.dns_name[] not null check (cardinality(domains) between 1 and 5),
  website text check (website ~ '^https?://' and char_length(website) <= 300),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  college_id uuid references public.colleges (id) on delete set null
);
create index college_requests_status_idx on public.college_requests (status, created_at);
create index college_requests_email_idx on public.college_requests (email, created_at);

-- ---------------------------------------------------------------------------
-- Caller helpers (used by RLS policies throughout the schema)
-- ---------------------------------------------------------------------------

-- The caller's college, but only once they have verified their email by OTP.
-- An account that exists but never completed an OTP sees nothing.
create function public.auth_college_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.college_id
  from public.profiles p
  where p.id = auth.uid()
    and p.email_verified_at is not null;
$$;

-- Whether the caller may create or change anything (posts, bookings, ...):
-- onboarded, not banned, and email re-verified within the configured window.
create function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not p.is_banned
       and p.onboarded_at is not null
       and p.email_verified_at >= now() - make_interval(days => s.reverify_after_days)
    from public.profiles p
    cross join public.app_settings s
    where p.id = auth.uid()
  ), false);
$$;

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.super_admins s on s.email = lower(u.email)
    join public.profiles p on p.id = u.id
    where u.id = auth.uid()
      and p.email_verified_at is not null
      and not p.is_banned
  );
$$;

-- ---------------------------------------------------------------------------
-- Sign-up gate, layer 1: Supabase "Before User Created" auth hook.
-- Configured in supabase/config.toml ([auth.hook.before_user_created]) and,
-- for cloud projects, in Dashboard → Authentication → Hooks.
-- ---------------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := event -> 'user' ->> 'email';
  v_domain text := public.email_domain(v_email);
begin
  if v_domain is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Sign up with your college email address.'));
  end if;

  if public.is_blocked_email_domain(v_domain) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Personal email addresses are not allowed. Use your college email.'));
  end if;

  if public.college_for_email(v_email) is null then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Your college is not on CampusPool yet.'));
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Sign-up gate, layer 2: triggers on auth.users. These hold even if the hook
-- is misconfigured or disabled, and also cover email changes.
-- ---------------------------------------------------------------------------
create function public.enforce_college_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_college_id uuid := public.college_for_email(new.email);
  v_current uuid;
begin
  if v_college_id is null then
    raise exception 'email domain is not an approved college domain'
      using errcode = '42501';
  end if;

  -- An email change may not move a user to a different college.
  if tg_op = 'UPDATE' then
    select college_id into v_current from public.profiles where id = new.id;
    if v_current is not null and v_current <> v_college_id then
      raise exception 'email change would move the account to another college'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_college_email_on_insert
  before insert on auth.users
  for each row execute function public.enforce_college_email();

create trigger enforce_college_email_on_update
  before update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.enforce_college_email();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, college_id)
  values (new.id, public.college_for_email(new.email));
  return new;
end;
$$;

create trigger create_profile_for_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Profile column guard. Column privileges (below) already stop API roles from
-- updating protected columns; this trigger is a second line of defence and
-- also makes gender set-once for users (admins can still correct it).
-- SECURITY DEFINER RPCs run as the table owner and are not affected.
-- ---------------------------------------------------------------------------
create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id is distinct from old.id
       or new.college_id is distinct from old.college_id
       or new.is_banned is distinct from old.is_banned
       or new.rating_avg is distinct from old.rating_avg
       or new.rating_count is distinct from old.rating_count
       or new.email_verified_at is distinct from old.email_verified_at
       or new.onboarded_at is distinct from old.onboarded_at
       or new.terms_accepted_at is distinct from old.terms_accepted_at
       or (old.gender is not null and new.gender is distinct from old.gender) then
      raise exception 'this profile field cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Same-college public view of profiles. The base table is readable only by
-- its owner; other users see this narrower projection: first name, avatar,
-- role and rating. Gender, year/department and timestamps stay private.
-- The view runs with its owner's rights, so it filters explicitly.
-- ---------------------------------------------------------------------------
create view public.profiles_public
with (security_barrier = true)
as
select
  p.id,
  p.college_id,
  split_part(btrim(p.full_name), ' ', 1) as first_name,
  p.avatar_url,
  p.role,
  p.rating_avg,
  p.rating_count
from public.profiles p
where p.college_id = public.auth_college_id()
  and p.onboarded_at is not null
  and not p.is_banned;

-- ---------------------------------------------------------------------------
-- RLS & privileges
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.private_contacts enable row level security;
alter table public.super_admins enable row level security;
alter table public.college_requests enable row level security;

revoke all on public.profiles, public.private_contacts, public.super_admins,
  public.college_requests, public.profiles_public from anon, authenticated;

-- profiles: own row only; a few columns are user-editable.
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, role, year_or_dept) on public.profiles to authenticated;

create policy "read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.can_write())
  with check (id = auth.uid());

grant select on public.profiles_public to authenticated;

-- private_contacts: own row only for now. Milestone 5 adds the
-- "other party of an accepted booking" policy. Writes go through RPCs.
grant select on public.private_contacts to authenticated;

create policy "read own contact"
  on public.private_contacts for select to authenticated
  using (user_id = auth.uid());

-- college_requests: super admins read; everyone else goes through the RPC.
grant select on public.college_requests to authenticated;

create policy "super admins read college requests"
  on public.college_requests for select to authenticated
  using (public.is_super_admin());

-- college_domains: super admins may read (admin panel).
grant select on public.college_domains to authenticated;

create policy "super admins read college domains"
  on public.college_domains for select to authenticated
  using (public.is_super_admin());

-- super_admins: no API access at all.

revoke execute on function public.auth_college_id(), public.can_write(), public.is_super_admin()
  from public, anon;
grant execute on function public.auth_college_id(), public.can_write(), public.is_super_admin()
  to authenticated;
revoke execute on function public.enforce_college_email(), public.handle_new_user()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record an OTP verification.
-- Reads the OTP time from the caller's signed JWT (`amr` claim), so a client
-- cannot fake it. Called by the server right after verifyOtp succeeds.
-- ---------------------------------------------------------------------------
create function public.record_email_verification()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_otp_at timestamptz;
  v_result timestamptz;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select max(to_timestamp((a ->> 'timestamp')::double precision))
    into v_otp_at
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
  where a ->> 'method' in ('otp', 'email/signup', 'magiclink');

  -- Checked before clamping: least() ignores NULLs, so least(NULL, now())
  -- would turn "no OTP in this session" into "verified just now".
  if v_otp_at is null then
    raise exception 'session was not created by an email code' using errcode = '42501';
  end if;
  v_otp_at := least(v_otp_at, now());

  update public.profiles
     set email_verified_at = greatest(coalesce(email_verified_at, '-infinity'), v_otp_at)
   where id = v_uid
  returning email_verified_at into v_result;

  return v_result;
end;
$$;

revoke execute on function public.record_email_verification() from public, anon;
grant execute on function public.record_email_verification() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: complete onboarding (spec §7.3).
-- Gender is set-once: a later call cannot change a gender already on file.
-- ---------------------------------------------------------------------------
create function public.complete_onboarding(
  p_full_name text,
  p_phone_e164 text,
  p_role public.user_role,
  p_gender public.gender default null,
  p_year_or_dept text default null,
  p_accept_terms boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found or v_profile.email_verified_at is null then
    raise exception 'verify your college email first' using errcode = '42501';
  end if;
  if v_profile.is_banned then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'you must accept the terms' using errcode = '22023';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 100 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid phone number' using errcode = '22023';
  end if;
  if p_role is null then
    raise exception 'choose student or staff' using errcode = '22023';
  end if;

  update public.profiles
     set full_name = btrim(p_full_name),
         role = p_role,
         gender = coalesce(v_profile.gender, p_gender),
         year_or_dept = nullif(btrim(p_year_or_dept), ''),
         terms_accepted_at = coalesce(v_profile.terms_accepted_at, now()),
         onboarded_at = coalesce(v_profile.onboarded_at, now())
   where id = v_uid;

  insert into public.private_contacts (user_id, phone_e164)
  values (v_uid, p_phone_e164)
  on conflict (user_id) do update
    set phone_e164 = excluded.phone_e164,
        phone_verified = case
          when public.private_contacts.phone_e164 = excluded.phone_e164
            then public.private_contacts.phone_verified
          else false
        end;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, public.user_role, public.gender, text, boolean)
  from public, anon;
grant execute on function public.complete_onboarding(text, text, public.user_role, public.gender, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: request a college (spec §3.3). Anonymous: the requester cannot sign
-- in until their college exists. The requester's own email must be at one
-- of the claimed domains, and each email may file 3 requests per day.
-- ---------------------------------------------------------------------------
create function public.submit_college_request(
  p_email text,
  p_college_name text,
  p_city text,
  p_domains text[],
  p_website text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_domain text := public.email_domain(p_email);
  v_domains text[];
  v_id uuid;
begin
  if v_domain is null then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  select array_agg(distinct rtrim(lower(btrim(d)), '.'))
    into v_domains
  from unnest(p_domains) d
  where nullif(btrim(d), '') is not null;

  if v_domains is null or cardinality(v_domains) not between 1 and 5 then
    raise exception 'list between 1 and 5 email domains' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(v_domains) d where public.is_blocked_email_domain(d)) then
    raise exception 'public email providers cannot be college domains' using errcode = '22023';
  end if;

  if not exists (select 1 from unnest(v_domains) d where public.domain_matches(v_domain, d)) then
    raise exception 'your email must be at one of the domains you list' using errcode = '22023';
  end if;

  if public.college_for_email(v_email) is not null then
    raise exception 'this college is already on CampusPool' using errcode = '22023';
  end if;

  if (select count(*) from public.college_requests
      where email = v_email and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too many requests, try again tomorrow' using errcode = '54000';
  end if;

  insert into public.college_requests (email, college_name, city, domains, website)
  values (v_email, btrim(p_college_name), btrim(p_city), v_domains::public.dns_name[],
          nullif(btrim(p_website), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_college_request(text, text, text, text[], text) from public;
grant execute on function public.submit_college_request(text, text, text, text[], text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs: super-admin review of college requests.
-- ---------------------------------------------------------------------------
create function public.approve_college_request(
  p_request_id uuid,
  p_name text,
  p_short_name text,
  p_city text,
  p_domains text[],
  p_campus_lng double precision default null,
  p_campus_lat double precision default null,
  p_country_code text default 'AE'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.college_requests;
  v_college_id uuid;
  v_domains text[];
begin
  if not public.is_super_admin() then
    raise exception 'super admin only' using errcode = '42501';
  end if;

  select * into v_request from public.college_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request already reviewed' using errcode = '22023';
  end if;

  select array_agg(distinct rtrim(lower(btrim(d)), '.'))
    into v_domains
  from unnest(p_domains) d
  where nullif(btrim(d), '') is not null;

  if v_domains is null or cardinality(v_domains) = 0 then
    raise exception 'at least one domain is required' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_domains) d where public.is_blocked_email_domain(d)) then
    raise exception 'public email providers cannot be college domains' using errcode = '22023';
  end if;
  if (p_campus_lng is null) <> (p_campus_lat is null)
     or p_campus_lat not between -90 and 90
     or p_campus_lng not between -180 and 180 then
    raise exception 'invalid campus coordinates' using errcode = '22023';
  end if;

  insert into public.colleges (name, short_name, city, country_code, campus_point)
  values (
    btrim(p_name), btrim(p_short_name), btrim(p_city), upper(p_country_code),
    case when p_campus_lng is null then null
         else extensions.st_setsrid(extensions.st_makepoint(p_campus_lng, p_campus_lat), 4326)::extensions.geography
    end
  )
  returning id into v_college_id;

  insert into public.college_domains (college_id, domain)
  select v_college_id, d::public.dns_name from unnest(v_domains) d;

  update public.college_requests
     set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
         college_id = v_college_id
   where id = p_request_id;

  return v_college_id;
end;
$$;

create function public.reject_college_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'super admin only' using errcode = '42501';
  end if;

  update public.college_requests
     set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'request not found or already reviewed' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function
  public.approve_college_request(uuid, text, text, text, text[], double precision, double precision, text),
  public.reject_college_request(uuid)
  from public, anon;
grant execute on function
  public.approve_college_request(uuid, text, text, text, text[], double precision, double precision, text),
  public.reject_college_request(uuid)
  to authenticated;
