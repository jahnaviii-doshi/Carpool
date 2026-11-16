-- Milestone 2a: colleges, email domains, the public-provider blocklist and
-- the domain-matching functions every other auth check is built on.
--
-- Security model: none of these tables is writable by API roles. Reads go
-- through narrowly-scoped SECURITY DEFINER functions or RLS policies, and
-- writes go through admin RPCs (see 20261116010100_profiles_and_auth.sql).

-- ---------------------------------------------------------------------------
-- App-wide settings (single row)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  -- Users must re-verify their college email by OTP this often (spec §3.2).
  reverify_after_days int not null default 180 check (reverify_after_days between 1 and 3650)
);
insert into public.app_settings default values;

alter table public.app_settings enable row level security;
create policy "app_settings readable by signed-in users"
  on public.app_settings for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Colleges and their email domains
-- ---------------------------------------------------------------------------
create type public.college_status as enum ('active', 'pending');

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  short_name text not null check (char_length(short_name) between 1 and 30),
  city text not null check (char_length(city) between 1 and 100),
  country_code text not null default 'AE' check (country_code ~ '^[A-Z]{2}$'),
  campus_point extensions.geography(Point, 4326),
  status public.college_status not null default 'active',
  created_at timestamptz not null default now()
);
create index colleges_campus_point_gix on public.colleges using gist (campus_point);

-- A valid, lower-case DNS name with at least two labels.
create domain public.dns_name as text
  check (
    value = lower(value)
    and char_length(value) <= 253
    and value ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  );

create table public.college_domains (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  domain public.dns_name not null unique
);
create index college_domains_college_id_idx on public.college_domains (college_id);

-- ---------------------------------------------------------------------------
-- Public email providers that can never be a college domain
-- ---------------------------------------------------------------------------
create table public.blocked_email_domains (
  -- `pattern` is a domain ("gmail.com") or, with any_tld, a bare label
  -- ("yahoo") that is blocked under every TLD: yahoo.com, yahoo.co.in, ...
  pattern text primary key check (pattern = lower(pattern) and pattern ~ '^[a-z0-9.-]+$'),
  any_tld boolean not null default false
);

insert into public.blocked_email_domains (pattern, any_tld) values
  ('gmail.com', false), ('googlemail.com', false),
  ('yahoo', true), ('ymail.com', false), ('rocketmail.com', false),
  ('outlook', true), ('hotmail', true), ('live', true), ('msn.com', false),
  ('icloud.com', false), ('me.com', false), ('mac.com', false),
  ('proton.me', false), ('protonmail.com', false), ('protonmail.ch', false), ('pm.me', false),
  ('aol.com', false), ('gmx', true), ('mail.com', false), ('zoho.com', false), ('zohomail.com', false),
  ('yandex', true), ('rediffmail.com', false), ('tutanota.com', false), ('tuta.io', false),
  ('fastmail.com', false), ('hey.com', false), ('qq.com', false), ('163.com', false),
  ('mailinator.com', false), ('guerrillamail.com', false), ('10minutemail.com', false),
  ('temp-mail.org', false);

-- ---------------------------------------------------------------------------
-- Domain helpers
-- ---------------------------------------------------------------------------

-- Extracts the domain from an email address. Returns NULL for anything that
-- is not a single plausible address. Lower-cases and trims.
create function public.email_domain(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when m is null then null
    else rtrim(m[1], '.')
  end
  from (
    select regexp_match(
      lower(btrim(p_email)),
      '^[a-z0-9._%+''-]+@([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.?)$'
    ) as m
  ) s;
$$;

-- True when `p_domain` equals `p_parent` or is a subdomain of it, compared on
-- a dot boundary: cs.aus.edu matches aus.edu, fakeaus.edu does not.
create function public.domain_matches(p_domain text, p_parent text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_domain = p_parent
      or right(p_domain, char_length(p_parent) + 1) = '.' || p_parent;
$$;

create function public.is_blocked_email_domain(p_domain text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.blocked_email_domains b
    where (not b.any_tld and public.domain_matches(p_domain, b.pattern))
       or (b.any_tld and p_domain ~ ('(^|\.)' || b.pattern || '(\.[a-z]{2,})+$'))
  );
$$;

-- The active college an email address belongs to, or NULL. The most specific
-- (longest) matching domain wins. Public providers never match.
create function public.college_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select public.email_domain(p_email) as domain)
  select cd.college_id
  from d
  join public.college_domains cd on public.domain_matches(d.domain, cd.domain)
  join public.colleges c on c.id = cd.college_id
  where d.domain is not null
    and c.status = 'active'
    and not public.is_blocked_email_domain(d.domain)
  order by char_length(cd.domain) desc
  limit 1;
$$;

-- Pre-OTP check used by the sign-in screen (spec §3.1 step 2). Callable by
-- anonymous users; reveals only whether a domain belongs to a listed college,
-- which is public information, and never whether an account exists.
create function public.check_signup_email(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_domain text := public.email_domain(p_email);
  v_college_id uuid;
  v_college_name text;
begin
  if v_domain is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if public.is_blocked_email_domain(v_domain) then
    return jsonb_build_object('status', 'public_provider', 'domain', v_domain);
  end if;

  v_college_id := public.college_for_email(p_email);
  if v_college_id is null then
    return jsonb_build_object('status', 'unknown_college', 'domain', v_domain);
  end if;

  select name into v_college_name from public.colleges where id = v_college_id;
  return jsonb_build_object('status', 'ok', 'college_name', v_college_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges & RLS
-- ---------------------------------------------------------------------------
alter table public.colleges enable row level security;
alter table public.college_domains enable row level security;
alter table public.blocked_email_domains enable row level security;

-- College names are public (shown on the sign-in screen and in onboarding).
create policy "active colleges are public"
  on public.colleges for select to anon, authenticated
  using (status = 'active');

revoke all on public.colleges, public.college_domains, public.blocked_email_domains,
  public.app_settings from anon, authenticated;
grant select on public.colleges to anon, authenticated;
grant select on public.app_settings to authenticated;

revoke execute on function public.is_blocked_email_domain(text), public.college_for_email(text)
  from public, anon, authenticated;
grant execute on function public.check_signup_email(text) to anon, authenticated;
