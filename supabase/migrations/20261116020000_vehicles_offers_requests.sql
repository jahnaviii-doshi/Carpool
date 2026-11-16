-- Milestone 3: vehicles, ride offers, ride requests, location fuzzing,
-- recurring series, and the public views other users read from.
--
-- Privacy model
--   * Base tables (vehicles, vehicle_plates, ride_offers, ride_requests) are
--     readable only by their owner. Milestone 5 adds "the other party of an
--     accepted booking".
--   * Everyone else in the same college reads offers_public / requests_public,
--     which expose only fuzzed points, a coarse area name and a vehicle
--     summary. Exact points, exact labels and number plates never appear in
--     a list or search response.
--   * All writes go through SECURITY DEFINER RPCs that check can_write().

-- ---------------------------------------------------------------------------
-- College-level settings used by rides
-- ---------------------------------------------------------------------------
alter table public.colleges
  add column timezone text not null default 'Asia/Dubai',
  -- Fuel-cost splitting. Off for UAE colleges: carrying passengers for money
  -- in a private car is illegal passenger transport there.
  add column cost_sharing_enabled boolean not null default false,
  add column currency text not null default 'AED' check (currency ~ '^[A-Z]{3}$');

alter table public.app_settings
  -- Max cost per seat = ceil(max_cost_per_km * route km / seats_total).
  add column max_cost_per_km numeric(6, 2) not null default 4 check (max_cost_per_km >= 0),
  -- Posting limits (spec §8): offers + requests created per user per day.
  add column max_posts_per_day int not null default 10 check (max_posts_per_day > 0),
  -- How far ahead recurring rides are materialised as dated rides.
  add column series_horizon_days int not null default 14 check (series_horizon_days between 1 and 60),
  -- Both ends of a ride must be within this distance of campus.
  add column max_distance_from_campus_m int not null default 150000;

-- ---------------------------------------------------------------------------
-- Location fuzzing
--
-- Other users see a point moved 200–400 m from the real one. The offset is
-- derived from HMAC(secret, user id + ~100 m grid cell), not re-randomised
-- each time: a driver who posts the same home address every day always shows
-- the same fuzzed point, so averaging many posts cannot reveal the real one.
-- The secret lives in a schema no API role can read.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.secrets (
  name text primary key,
  value bytea not null
);
insert into private.secrets (name, value)
values ('location_fuzz', extensions.gen_random_bytes(32));

create function public.fuzz_location(p_owner uuid, p_point extensions.geography)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret bytea;
  v_cell text;
  v_hash bytea;
  v_bearing double precision;
  v_distance double precision;
begin
  if p_point is null then
    return null;
  end if;

  select value into strict v_secret from private.secrets where name = 'location_fuzz';

  v_cell := round(extensions.st_x(p_point::extensions.geometry)::numeric, 3)::text || ','
         || round(extensions.st_y(p_point::extensions.geometry)::numeric, 3)::text;
  v_hash := extensions.hmac(convert_to(p_owner::text || '|' || v_cell, 'UTF8'), v_secret, 'sha256');

  v_bearing := ((get_byte(v_hash, 0) << 8) | get_byte(v_hash, 1))::double precision / 65535 * 2 * pi();
  v_distance := 200 + ((get_byte(v_hash, 2) << 8) | get_byte(v_hash, 3))::double precision / 65535 * 200;

  return extensions.st_project(p_point, v_distance, v_bearing);
end;
$$;

revoke execute on function public.fuzz_location(uuid, extensions.geography) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create type public.vehicle_type as enum ('car', 'bike');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  college_id uuid not null references public.colleges (id),
  type public.vehicle_type not null,
  make text not null check (char_length(btrim(make)) between 1 and 40),
  model text not null check (char_length(btrim(model)) between 1 and 40),
  color text not null check (char_length(btrim(color)) between 1 and 30),
  -- Passenger seats (excluding the driver).
  seats int not null check (seats between 1 and 7),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type = 'car' or seats = 1)
);
create index vehicles_owner_idx on public.vehicles (owner_id) where is_active;

-- Number plates are kept apart, like phone numbers, so RLS can hide them
-- until a booking is accepted (Milestone 5).
create table public.vehicle_plates (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  plate_number text not null check (plate_number ~ '^[A-Z0-9][A-Z0-9 -]{0,18}[A-Z0-9]$')
);

-- ---------------------------------------------------------------------------
-- Ride offers
--
-- A row with recurring_days set is a *series template*: it is never shown to
-- other users or matched. materialize_offer_series() turns it into ordinary
-- dated rows (series_id = template id) for the next series_horizon_days, so
-- seats and bookings always belong to one specific day.
-- ---------------------------------------------------------------------------
create type public.offer_status as enum ('open', 'full', 'departed', 'completed', 'cancelled');

create table public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.ride_offers (id) on delete cascade,
  driver_id uuid not null references public.profiles (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  college_id uuid not null references public.colleges (id),

  origin_point extensions.geography(Point, 4326) not null,
  origin_label text not null check (char_length(origin_label) between 1 and 300),
  origin_area text check (char_length(origin_area) <= 120),
  origin_fuzzed extensions.geography(Point, 4326) not null,

  dest_point extensions.geography(Point, 4326) not null,
  dest_label text not null check (char_length(dest_label) between 1 and 300),
  dest_area text check (char_length(dest_area) <= 120),
  dest_fuzzed extensions.geography(Point, 4326) not null,

  route extensions.geography(LineString, 4326),

  depart_at timestamptz not null,
  flex_minutes int not null default 15 check (flex_minutes between 0 and 120),
  seats_total int not null check (seats_total between 1 and 7),
  seats_available int not null check (seats_available >= 0 and seats_available <= seats_total),

  recurring_days int[] check (
    recurring_days is null
    or (cardinality(recurring_days) between 1 and 7 and recurring_days <@ array[0, 1, 2, 3, 4, 5, 6])
  ),
  recurring_until date,

  cost_per_seat int check (cost_per_seat >= 0),
  women_only boolean not null default false,
  notes text check (char_length(notes) <= 500),
  status public.offer_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (recurring_days is null or series_id is null),
  check ((recurring_days is null) = (recurring_until is null))
);

create index ride_offers_origin_point_gix on public.ride_offers using gist (origin_point);
create index ride_offers_origin_fuzzed_gix on public.ride_offers using gist (origin_fuzzed);
create index ride_offers_dest_point_gix on public.ride_offers using gist (dest_point);
create index ride_offers_dest_fuzzed_gix on public.ride_offers using gist (dest_fuzzed);
create index ride_offers_route_gix on public.ride_offers using gist (route);
create index ride_offers_feed_idx on public.ride_offers (college_id, status, depart_at)
  where recurring_days is null;
create index ride_offers_driver_idx on public.ride_offers (driver_id, created_at);
create unique index ride_offers_series_day_uidx on public.ride_offers (series_id, depart_at)
  where series_id is not null;

-- ---------------------------------------------------------------------------
-- Ride requests (same template / occurrence model)
-- ---------------------------------------------------------------------------
create type public.ride_request_status as enum ('open', 'matched', 'cancelled', 'expired');

create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.ride_requests (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  college_id uuid not null references public.colleges (id),

  pickup_point extensions.geography(Point, 4326) not null,
  pickup_label text not null check (char_length(pickup_label) between 1 and 300),
  pickup_area text check (char_length(pickup_area) <= 120),
  pickup_fuzzed extensions.geography(Point, 4326) not null,

  dest_point extensions.geography(Point, 4326) not null,
  dest_label text not null check (char_length(dest_label) between 1 and 300),
  dest_area text check (char_length(dest_area) <= 120),
  dest_fuzzed extensions.geography(Point, 4326) not null,

  window_start timestamptz not null,
  window_end timestamptz not null,
  seats_needed int not null default 1 check (seats_needed between 1 and 6),
  women_only_pref boolean not null default false,

  recurring_days int[] check (
    recurring_days is null
    or (cardinality(recurring_days) between 1 and 7 and recurring_days <@ array[0, 1, 2, 3, 4, 5, 6])
  ),
  recurring_until date,

  notes text check (char_length(notes) <= 500),
  status public.ride_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (window_end > window_start and window_end - window_start <= interval '6 hours'),
  check (recurring_days is null or series_id is null),
  check ((recurring_days is null) = (recurring_until is null))
);

create index ride_requests_pickup_point_gix on public.ride_requests using gist (pickup_point);
create index ride_requests_pickup_fuzzed_gix on public.ride_requests using gist (pickup_fuzzed);
create index ride_requests_dest_point_gix on public.ride_requests using gist (dest_point);
create index ride_requests_dest_fuzzed_gix on public.ride_requests using gist (dest_fuzzed);
create index ride_requests_feed_idx on public.ride_requests (college_id, status, window_start)
  where recurring_days is null;
create index ride_requests_rider_idx on public.ride_requests (rider_id, created_at);
create unique index ride_requests_series_day_uidx on public.ride_requests (series_id, window_start)
  where series_id is not null;

-- ---------------------------------------------------------------------------
-- Triggers: college_id always comes from the owner's profile (anything the
-- caller sends is overwritten), fuzzed points are always recomputed, and
-- updated_at is maintained.
-- ---------------------------------------------------------------------------
create function public.set_vehicle_college()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select college_id into strict new.college_id from public.profiles where id = new.owner_id;
  return new;
end;
$$;

create trigger set_vehicle_college
  before insert or update of owner_id, college_id on public.vehicles
  for each row execute function public.set_vehicle_college();

create function public.prepare_ride_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select college_id into strict new.college_id from public.profiles where id = new.driver_id;
  new.origin_fuzzed := public.fuzz_location(new.driver_id, new.origin_point);
  new.dest_fuzzed := public.fuzz_location(new.driver_id, new.dest_point);
  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_ride_offer
  before insert or update on public.ride_offers
  for each row execute function public.prepare_ride_offer();

create function public.prepare_ride_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select college_id into strict new.college_id from public.profiles where id = new.rider_id;
  new.pickup_fuzzed := public.fuzz_location(new.rider_id, new.pickup_point);
  new.dest_fuzzed := public.fuzz_location(new.rider_id, new.dest_point);
  new.updated_at := now();
  return new;
end;
$$;

create trigger prepare_ride_request
  before insert or update on public.ride_requests
  for each row execute function public.prepare_ride_request();

revoke execute on function public.set_vehicle_college(), public.prepare_ride_offer(),
  public.prepare_ride_request() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared validation helpers (internal)
-- ---------------------------------------------------------------------------

-- Builds a point and checks it is a sane coordinate near the caller's campus.
create function public.validated_point(
  p_lng double precision,
  p_lat double precision,
  p_college_id uuid,
  p_what text
)
returns extensions.geography
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography;
  v_campus extensions.geography;
  v_max int;
begin
  if p_lng is null or p_lat is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception '% location is missing or invalid', p_what using errcode = '22023';
  end if;
  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  select c.campus_point, s.max_distance_from_campus_m into v_campus, v_max
  from public.colleges c cross join public.app_settings s
  where c.id = p_college_id;

  if v_campus is not null and not extensions.st_dwithin(v_point, v_campus, v_max) then
    raise exception '% is too far from campus', p_what using errcode = '22023';
  end if;
  return v_point;
end;
$$;

create function public.validated_recurrence(p_days int[], p_until date, p_first date)
returns int[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days int[];
begin
  if p_days is null or cardinality(p_days) = 0 then
    return null;
  end if;
  select array_agg(distinct d order by d) into v_days from unnest(p_days) d;
  if not v_days <@ array[0, 1, 2, 3, 4, 5, 6] then
    raise exception 'repeat days must be between Sunday (0) and Saturday (6)' using errcode = '22023';
  end if;
  if p_until is null or p_until < p_first or p_until > p_first + 120 then
    raise exception 'a repeating ride must end within 120 days of its first date' using errcode = '22023';
  end if;
  return v_days;
end;
$$;

create function public.check_post_rate_limit(p_uid uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_max int;
begin
  select max_posts_per_day into v_max from public.app_settings;
  select
    (select count(*) from public.ride_offers
      where driver_id = p_uid and series_id is null and created_at > now() - interval '1 day')
  + (select count(*) from public.ride_requests
      where rider_id = p_uid and series_id is null and created_at > now() - interval '1 day')
  into v_count;
  if v_count >= v_max then
    raise exception 'you can post at most % rides a day', v_max using errcode = '54000';
  end if;
end;
$$;

revoke execute on function
  public.validated_point(double precision, double precision, uuid, text),
  public.validated_recurrence(int[], date, date),
  public.check_post_rate_limit(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Series materialisation (internal; also run daily by pg_cron)
-- ---------------------------------------------------------------------------
create function public.materialize_offer_series(p_template_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.ride_offers;
  v_tz text;
  v_horizon int;
  v_today date;
  v_local_time time;
  v_day date;
  v_depart timestamptz;
  v_created int := 0;
begin
  select * into t from public.ride_offers
  where id = p_template_id and recurring_days is not null and status = 'open';
  if not found then
    return 0;
  end if;

  select c.timezone into v_tz from public.colleges c where c.id = t.college_id;
  select series_horizon_days into v_horizon from public.app_settings;
  v_today := (now() at time zone v_tz)::date;
  v_local_time := (t.depart_at at time zone v_tz)::time;

  for v_day in
    select d::date from generate_series(
      greatest(v_today, (t.depart_at at time zone v_tz)::date),
      least(v_today + v_horizon, t.recurring_until),
      interval '1 day') d
  loop
    continue when not (extract(dow from v_day)::int = any (t.recurring_days));
    v_depart := (v_day + v_local_time) at time zone v_tz;
    continue when v_depart <= now();

    insert into public.ride_offers (
      series_id, driver_id, vehicle_id, origin_point, origin_label, origin_area, origin_fuzzed,
      dest_point, dest_label, dest_area, dest_fuzzed, route, depart_at, flex_minutes,
      seats_total, seats_available, cost_per_seat, women_only, notes, college_id
    ) values (
      t.id, t.driver_id, t.vehicle_id, t.origin_point, t.origin_label, t.origin_area, t.origin_fuzzed,
      t.dest_point, t.dest_label, t.dest_area, t.dest_fuzzed, t.route, v_depart, t.flex_minutes,
      t.seats_total, t.seats_total, t.cost_per_seat, t.women_only, t.notes, t.college_id
    )
    on conflict (series_id, depart_at) where series_id is not null do nothing;
    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

create function public.materialize_request_series(p_template_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.ride_requests;
  v_tz text;
  v_horizon int;
  v_today date;
  v_start_time time;
  v_length interval;
  v_day date;
  v_start timestamptz;
  v_created int := 0;
begin
  select * into t from public.ride_requests
  where id = p_template_id and recurring_days is not null and status = 'open';
  if not found then
    return 0;
  end if;

  select c.timezone into v_tz from public.colleges c where c.id = t.college_id;
  select series_horizon_days into v_horizon from public.app_settings;
  v_today := (now() at time zone v_tz)::date;
  v_start_time := (t.window_start at time zone v_tz)::time;
  v_length := t.window_end - t.window_start;

  for v_day in
    select d::date from generate_series(
      greatest(v_today, (t.window_start at time zone v_tz)::date),
      least(v_today + v_horizon, t.recurring_until),
      interval '1 day') d
  loop
    continue when not (extract(dow from v_day)::int = any (t.recurring_days));
    v_start := (v_day + v_start_time) at time zone v_tz;
    continue when v_start + v_length <= now();

    insert into public.ride_requests (
      series_id, rider_id, pickup_point, pickup_label, pickup_area, pickup_fuzzed,
      dest_point, dest_label, dest_area, dest_fuzzed, window_start, window_end,
      seats_needed, women_only_pref, notes, college_id
    ) values (
      t.id, t.rider_id, t.pickup_point, t.pickup_label, t.pickup_area, t.pickup_fuzzed,
      t.dest_point, t.dest_label, t.dest_area, t.dest_fuzzed, v_start, v_start + v_length,
      t.seats_needed, t.women_only_pref, t.notes, t.college_id
    )
    on conflict (series_id, window_start) where series_id is not null do nothing;
    if found then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

create function public.materialize_all_series()
returns int
language sql
volatile
security definer
set search_path = ''
as $$
  select coalesce(sum(n), 0)::int from (
    select public.materialize_offer_series(id) as n
    from public.ride_offers where recurring_days is not null and status = 'open'
    union all
    select public.materialize_request_series(id)
    from public.ride_requests where recurring_days is not null and status = 'open'
  ) s;
$$;

revoke execute on function
  public.materialize_offer_series(uuid),
  public.materialize_request_series(uuid),
  public.materialize_all_series()
  from public, anon, authenticated;

select cron.schedule(
  'materialize-ride-series',
  '7 0 * * *',  -- daily, 00:07 UTC
  $$ select public.materialize_all_series() $$
);

-- ---------------------------------------------------------------------------
-- RPC: vehicles
-- ---------------------------------------------------------------------------
create function public.save_vehicle(
  p_type public.vehicle_type,
  p_make text,
  p_model text,
  p_color text,
  p_seats int,
  p_plate_number text,
  p_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_plate text := upper(regexp_replace(btrim(coalesce(p_plate_number, '')), '\s+', ' ', 'g'));
begin
  if not public.can_write() then
    raise exception 'your account cannot make changes right now' using errcode = '42501';
  end if;
  if p_type = 'bike' and p_seats <> 1 then
    raise exception 'a bike carries one passenger' using errcode = '22023';
  end if;
  if v_plate !~ '^[A-Z0-9][A-Z0-9 -]{0,18}[A-Z0-9]$' then
    raise exception 'enter the number plate, e.g. SHJ 3 12345' using errcode = '22023';
  end if;

  if p_id is null then
    if (select count(*) from public.vehicles where owner_id = v_uid and is_active) >= 5 then
      raise exception 'you can have at most 5 vehicles' using errcode = '54000';
    end if;
    insert into public.vehicles (owner_id, college_id, type, make, model, color, seats)
    values (v_uid, '00000000-0000-0000-0000-000000000000', p_type, btrim(p_make), btrim(p_model),
            btrim(p_color), p_seats)
    returning id into v_id;
  else
    update public.vehicles
       set type = p_type, make = btrim(p_make), model = btrim(p_model),
           color = btrim(p_color), seats = p_seats
     where id = p_id and owner_id = v_uid and is_active
    returning id into v_id;
    if v_id is null then
      raise exception 'vehicle not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.vehicle_plates (vehicle_id, plate_number) values (v_id, v_plate)
  on conflict (vehicle_id) do update set plate_number = excluded.plate_number;

  return v_id;
end;
$$;

create function public.remove_vehicle(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ride_offers
    where vehicle_id = p_id and status in ('open', 'full')
      and (recurring_days is not null or depart_at > now())
  ) then
    raise exception 'cancel the upcoming rides that use this vehicle first' using errcode = '22023';
  end if;

  update public.vehicles set is_active = false where id = p_id and owner_id = auth.uid();
  if not found then
    raise exception 'vehicle not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create or edit a ride offer
-- ---------------------------------------------------------------------------
create function public.save_ride_offer(
  p_vehicle_id uuid,
  p_origin_lng double precision,
  p_origin_lat double precision,
  p_origin_label text,
  p_dest_lng double precision,
  p_dest_lat double precision,
  p_dest_label text,
  p_depart_local timestamp,
  p_seats_total int,
  p_flex_minutes int default 15,
  p_origin_area text default null,
  p_dest_area text default null,
  p_recurring_days int[] default null,
  p_recurring_until date default null,
  p_cost_per_seat int default null,
  p_women_only boolean default false,
  p_notes text default null,
  p_route_geojson text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_college public.colleges;
  v_settings public.app_settings;
  v_vehicle public.vehicles;
  v_existing public.ride_offers;
  v_origin extensions.geography;
  v_dest extensions.geography;
  v_route extensions.geography;
  v_depart timestamptz;
  v_days int[];
  v_until date;
  v_cap int;
  v_id uuid;
begin
  if not public.can_write() then
    raise exception 'your account cannot make changes right now' using errcode = '42501';
  end if;

  select * into strict v_profile from public.profiles where id = v_uid;
  select * into strict v_college from public.colleges where id = v_profile.college_id;
  select * into strict v_settings from public.app_settings;

  if p_id is not null then
    select * into v_existing from public.ride_offers
    where id = p_id and driver_id = v_uid for update;
    if not found or v_existing.status <> 'open' then
      raise exception 'ride not found or no longer editable' using errcode = 'P0002';
    end if;
  else
    perform public.check_post_rate_limit(v_uid);
  end if;

  -- Vehicle
  select * into v_vehicle from public.vehicles
  where id = p_vehicle_id and owner_id = v_uid and is_active;
  if not found then
    raise exception 'choose one of your vehicles' using errcode = '22023';
  end if;
  if p_seats_total is null or p_seats_total < 1 or p_seats_total > v_vehicle.seats then
    raise exception 'seats must be between 1 and %', v_vehicle.seats using errcode = '22023';
  end if;

  -- Places
  v_origin := public.validated_point(p_origin_lng, p_origin_lat, v_college.id, 'Starting point');
  v_dest := public.validated_point(p_dest_lng, p_dest_lat, v_college.id, 'Destination');
  if extensions.st_dwithin(v_origin, v_dest, 300) then
    raise exception 'start and destination are the same place' using errcode = '22023';
  end if;
  if nullif(btrim(p_origin_label), '') is null or nullif(btrim(p_dest_label), '') is null then
    raise exception 'start and destination need a name' using errcode = '22023';
  end if;

  -- Optional route from the routing provider: must start and end near the
  -- chosen points.
  if p_route_geojson is not null then
    begin
      v_route := extensions.st_setsrid(extensions.st_geomfromgeojson(p_route_geojson), 4326)::extensions.geography;
    exception when others then
      raise exception 'invalid route' using errcode = '22023';
    end;
    if extensions.geometrytype(v_route::extensions.geometry) <> 'LINESTRING'
       or extensions.st_npoints(v_route::extensions.geometry) > 5000
       or not extensions.st_dwithin(
         extensions.st_startpoint(v_route::extensions.geometry)::extensions.geography, v_origin, 2000)
       or not extensions.st_dwithin(
         extensions.st_endpoint(v_route::extensions.geometry)::extensions.geography, v_dest, 2000) then
      raise exception 'invalid route' using errcode = '22023';
    end if;
  end if;

  -- Time (entered in the college's local time zone)
  if p_depart_local is null then
    raise exception 'choose a departure time' using errcode = '22023';
  end if;
  v_depart := p_depart_local at time zone v_college.timezone;
  if v_depart <= now() then
    raise exception 'departure time must be in the future' using errcode = '22023';
  end if;
  if v_depart > now() + interval '60 days' then
    raise exception 'you can post rides up to 60 days ahead' using errcode = '22023';
  end if;
  if p_flex_minutes is null or p_flex_minutes not between 0 and 120 then
    raise exception 'flexibility must be between 0 and 120 minutes' using errcode = '22023';
  end if;

  v_days := public.validated_recurrence(p_recurring_days, p_recurring_until, p_depart_local::date);
  v_until := case when v_days is null then null else p_recurring_until end;
  if p_id is not null and (v_existing.recurring_days is null) <> (v_days is null) then
    raise exception 'a one-off ride cannot be turned into a repeating one (or back)' using errcode = '22023';
  end if;
  if p_id is not null and v_existing.series_id is not null and v_days is not null then
    raise exception 'edit the whole series instead' using errcode = '22023';
  end if;

  -- Cost sharing (spec §9): fuel split only, capped, and only where allowed.
  if p_cost_per_seat is not null then
    if not v_college.cost_sharing_enabled then
      raise exception 'rides at your college are free; cost sharing is turned off' using errcode = '22023';
    end if;
    v_cap := ceil(v_settings.max_cost_per_km
                  * coalesce(extensions.st_length(v_route), extensions.st_distance(v_origin, v_dest)) / 1000
                  / p_seats_total);
    if p_cost_per_seat < 0 or p_cost_per_seat > v_cap then
      raise exception 'cost per seat can be at most % % (fuel share only)', v_cap, v_college.currency
        using errcode = '22023';
    end if;
  end if;

  if coalesce(p_women_only, false) and v_profile.gender is distinct from 'female' then
    raise exception 'only women can post women-only rides' using errcode = '22023';
  end if;
  if char_length(p_notes) > 500 then
    raise exception 'notes can be at most 500 characters' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.ride_offers (
      driver_id, vehicle_id, college_id, origin_point, origin_label, origin_area, origin_fuzzed,
      dest_point, dest_label, dest_area, dest_fuzzed, route, depart_at, flex_minutes,
      seats_total, seats_available, recurring_days, recurring_until, cost_per_seat,
      women_only, notes
    ) values (
      v_uid, v_vehicle.id, v_college.id, v_origin, btrim(p_origin_label), nullif(btrim(p_origin_area), ''),
      v_origin, v_dest, btrim(p_dest_label), nullif(btrim(p_dest_area), ''), v_dest, v_route,
      v_depart, p_flex_minutes, p_seats_total, p_seats_total, v_days, v_until, p_cost_per_seat,
      coalesce(p_women_only, false), nullif(btrim(p_notes), '')
    )
    returning id into v_id;
  else
    if v_existing.seats_total - v_existing.seats_available > p_seats_total then
      raise exception 'more seats are already booked than that' using errcode = '22023';
    end if;
    update public.ride_offers set
      vehicle_id = v_vehicle.id,
      origin_point = v_origin, origin_label = btrim(p_origin_label), origin_area = nullif(btrim(p_origin_area), ''),
      dest_point = v_dest, dest_label = btrim(p_dest_label), dest_area = nullif(btrim(p_dest_area), ''),
      route = v_route, depart_at = v_depart, flex_minutes = p_flex_minutes,
      seats_available = p_seats_total - (v_existing.seats_total - v_existing.seats_available),
      seats_total = p_seats_total,
      recurring_days = v_days, recurring_until = v_until, cost_per_seat = p_cost_per_seat,
      women_only = coalesce(p_women_only, false), notes = nullif(btrim(p_notes), '')
    where id = p_id
    returning id into v_id;

    -- Editing a series replaces its future, still-untouched dates.
    -- (Milestone 5: dates with bookings are kept and their riders notified.)
    if v_days is not null then
      update public.ride_offers set status = 'cancelled'
      where series_id = v_id and status = 'open' and depart_at > now()
        and seats_available = seats_total;
    end if;
  end if;

  if v_days is not null then
    perform public.materialize_offer_series(v_id);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create or edit a ride request
-- ---------------------------------------------------------------------------
create function public.save_ride_request(
  p_pickup_lng double precision,
  p_pickup_lat double precision,
  p_pickup_label text,
  p_dest_lng double precision,
  p_dest_lat double precision,
  p_dest_label text,
  p_date date,
  p_window_start time,
  p_window_end time,
  p_seats_needed int default 1,
  p_pickup_area text default null,
  p_dest_area text default null,
  p_women_only_pref boolean default false,
  p_recurring_days int[] default null,
  p_recurring_until date default null,
  p_notes text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_college public.colleges;
  v_existing public.ride_requests;
  v_pickup extensions.geography;
  v_dest extensions.geography;
  v_start timestamptz;
  v_end timestamptz;
  v_days int[];
  v_until date;
  v_id uuid;
begin
  if not public.can_write() then
    raise exception 'your account cannot make changes right now' using errcode = '42501';
  end if;

  select * into strict v_profile from public.profiles where id = v_uid;
  select * into strict v_college from public.colleges where id = v_profile.college_id;

  if p_id is not null then
    select * into v_existing from public.ride_requests
    where id = p_id and rider_id = v_uid for update;
    if not found or v_existing.status <> 'open' then
      raise exception 'request not found or no longer editable' using errcode = 'P0002';
    end if;
  else
    perform public.check_post_rate_limit(v_uid);
  end if;

  v_pickup := public.validated_point(p_pickup_lng, p_pickup_lat, v_college.id, 'Pickup');
  v_dest := public.validated_point(p_dest_lng, p_dest_lat, v_college.id, 'Destination');
  if extensions.st_dwithin(v_pickup, v_dest, 300) then
    raise exception 'pickup and destination are the same place' using errcode = '22023';
  end if;
  if nullif(btrim(p_pickup_label), '') is null or nullif(btrim(p_dest_label), '') is null then
    raise exception 'pickup and destination need a name' using errcode = '22023';
  end if;

  if p_date is null or p_window_start is null or p_window_end is null then
    raise exception 'choose a date and time window' using errcode = '22023';
  end if;
  if p_window_end <= p_window_start then
    raise exception 'the latest time must be after the earliest time' using errcode = '22023';
  end if;
  v_start := (p_date + p_window_start) at time zone v_college.timezone;
  v_end := (p_date + p_window_end) at time zone v_college.timezone;
  if v_end - v_start > interval '6 hours' then
    raise exception 'keep the time window under 6 hours' using errcode = '22023';
  end if;
  if v_end <= now() then
    raise exception 'the time window must be in the future' using errcode = '22023';
  end if;
  if v_start > now() + interval '60 days' then
    raise exception 'you can post requests up to 60 days ahead' using errcode = '22023';
  end if;
  if p_seats_needed is null or p_seats_needed not between 1 and 6 then
    raise exception 'seats needed must be between 1 and 6' using errcode = '22023';
  end if;

  v_days := public.validated_recurrence(p_recurring_days, p_recurring_until, p_date);
  v_until := case when v_days is null then null else p_recurring_until end;
  if p_id is not null and (v_existing.recurring_days is null) <> (v_days is null) then
    raise exception 'a one-off request cannot be turned into a repeating one (or back)' using errcode = '22023';
  end if;
  if p_id is not null and v_existing.series_id is not null and v_days is not null then
    raise exception 'edit the whole series instead' using errcode = '22023';
  end if;

  if coalesce(p_women_only_pref, false) and v_profile.gender is distinct from 'female' then
    raise exception 'women-only rides are for women riders' using errcode = '22023';
  end if;
  if char_length(p_notes) > 500 then
    raise exception 'notes can be at most 500 characters' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.ride_requests (
      rider_id, college_id, pickup_point, pickup_label, pickup_area, pickup_fuzzed,
      dest_point, dest_label, dest_area, dest_fuzzed, window_start, window_end,
      seats_needed, women_only_pref, recurring_days, recurring_until, notes
    ) values (
      v_uid, v_college.id, v_pickup, btrim(p_pickup_label), nullif(btrim(p_pickup_area), ''), v_pickup,
      v_dest, btrim(p_dest_label), nullif(btrim(p_dest_area), ''), v_dest, v_start, v_end,
      p_seats_needed, coalesce(p_women_only_pref, false), v_days, v_until, nullif(btrim(p_notes), '')
    )
    returning id into v_id;
  else
    update public.ride_requests set
      pickup_point = v_pickup, pickup_label = btrim(p_pickup_label), pickup_area = nullif(btrim(p_pickup_area), ''),
      dest_point = v_dest, dest_label = btrim(p_dest_label), dest_area = nullif(btrim(p_dest_area), ''),
      window_start = v_start, window_end = v_end, seats_needed = p_seats_needed,
      women_only_pref = coalesce(p_women_only_pref, false),
      recurring_days = v_days, recurring_until = v_until, notes = nullif(btrim(p_notes), '')
    where id = p_id
    returning id into v_id;

    if v_days is not null then
      update public.ride_requests set status = 'cancelled'
      where series_id = v_id and status = 'open' and window_start > now();
    end if;
  end if;

  if v_days is not null then
    perform public.materialize_request_series(v_id);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: cancel. Cancelling a series template also cancels its future dates.
-- ---------------------------------------------------------------------------
create function public.cancel_ride_offer(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.ride_offers set status = 'cancelled'
  where id = p_id and driver_id = auth.uid() and status in ('open', 'full');
  if not found then
    raise exception 'ride not found or already finished' using errcode = 'P0002';
  end if;

  update public.ride_offers set status = 'cancelled'
  where series_id = p_id and status in ('open', 'full') and depart_at > now();
end;
$$;

create function public.cancel_ride_request(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.ride_requests set status = 'cancelled'
  where id = p_id and rider_id = auth.uid() and status = 'open';
  if not found then
    raise exception 'request not found or already finished' using errcode = 'P0002';
  end if;

  update public.ride_requests set status = 'cancelled'
  where series_id = p_id and status = 'open' and window_start > now();
end;
$$;

revoke execute on function
  public.save_vehicle(public.vehicle_type, text, text, text, int, text, uuid),
  public.remove_vehicle(uuid),
  public.save_ride_offer(uuid, double precision, double precision, text, double precision,
    double precision, text, timestamp, int, int, text, text, int[], date, int, boolean, text, text, uuid),
  public.save_ride_request(double precision, double precision, text, double precision,
    double precision, text, date, time, time, int, text, text, boolean, int[], date, text, uuid),
  public.cancel_ride_offer(uuid),
  public.cancel_ride_request(uuid)
  from public, anon;
grant execute on function
  public.save_vehicle(public.vehicle_type, text, text, text, int, text, uuid),
  public.remove_vehicle(uuid),
  public.save_ride_offer(uuid, double precision, double precision, text, double precision,
    double precision, text, timestamp, int, int, text, text, int[], date, int, boolean, text, text, uuid),
  public.save_ride_request(double precision, double precision, text, double precision,
    double precision, text, date, time, time, int, text, text, boolean, int[], date, text, uuid),
  public.cancel_ride_offer(uuid),
  public.cancel_ride_request(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RLS on base tables: owner only. No direct writes for API roles.
-- ---------------------------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.vehicle_plates enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ride_requests enable row level security;

revoke all on public.vehicles, public.vehicle_plates, public.ride_offers, public.ride_requests
  from anon, authenticated;
grant select on public.vehicles, public.vehicle_plates, public.ride_offers, public.ride_requests
  to authenticated;

create policy "owner reads own vehicles" on public.vehicles
  for select to authenticated using (owner_id = auth.uid());
create policy "owner reads own plates" on public.vehicle_plates
  for select to authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id and v.owner_id = auth.uid()));
create policy "driver reads own offers" on public.ride_offers
  for select to authenticated using (driver_id = auth.uid());
create policy "rider reads own requests" on public.ride_requests
  for select to authenticated using (rider_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Views for the owner: exact coordinates as numbers (security_invoker, so
-- the owner-only RLS above applies).
-- ---------------------------------------------------------------------------
create view public.my_offers
with (security_invoker = true)
as
select
  o.id, o.series_id, o.vehicle_id, o.college_id,
  extensions.st_y(o.origin_point::extensions.geometry) as origin_lat,
  extensions.st_x(o.origin_point::extensions.geometry) as origin_lng,
  o.origin_label, o.origin_area,
  extensions.st_y(o.dest_point::extensions.geometry) as dest_lat,
  extensions.st_x(o.dest_point::extensions.geometry) as dest_lng,
  o.dest_label, o.dest_area,
  o.depart_at, o.flex_minutes, o.seats_total, o.seats_available,
  o.recurring_days, o.recurring_until, o.cost_per_seat, o.women_only, o.notes,
  o.status, o.created_at,
  v.type as vehicle_type, v.make as vehicle_make, v.model as vehicle_model,
  v.color as vehicle_color
from public.ride_offers o
join public.vehicles v on v.id = o.vehicle_id;

create view public.my_requests
with (security_invoker = true)
as
select
  r.id, r.series_id, r.college_id,
  extensions.st_y(r.pickup_point::extensions.geometry) as pickup_lat,
  extensions.st_x(r.pickup_point::extensions.geometry) as pickup_lng,
  r.pickup_label, r.pickup_area,
  extensions.st_y(r.dest_point::extensions.geometry) as dest_lat,
  extensions.st_x(r.dest_point::extensions.geometry) as dest_lng,
  r.dest_label, r.dest_area,
  r.window_start, r.window_end, r.seats_needed, r.women_only_pref,
  r.recurring_days, r.recurring_until, r.notes, r.status, r.created_at
from public.ride_requests r;

-- ---------------------------------------------------------------------------
-- Public views for other users in the same college. These run with the
-- owner's rights (to read across users), so they filter explicitly and
-- expose only fuzzed points, the coarse area, and a vehicle summary.
-- ---------------------------------------------------------------------------
create view public.offers_public
with (security_barrier = true)
as
select
  o.id,
  o.driver_id,
  o.college_id,
  split_part(btrim(p.full_name), ' ', 1) as driver_first_name,
  p.rating_avg as driver_rating_avg,
  p.rating_count as driver_rating_count,
  extensions.st_y(o.origin_fuzzed::extensions.geometry) as origin_lat,
  extensions.st_x(o.origin_fuzzed::extensions.geometry) as origin_lng,
  o.origin_area,
  extensions.st_y(o.dest_fuzzed::extensions.geometry) as dest_lat,
  extensions.st_x(o.dest_fuzzed::extensions.geometry) as dest_lng,
  o.dest_area,
  o.depart_at,
  o.flex_minutes,
  o.seats_total,
  o.seats_available,
  o.cost_per_seat,
  o.women_only,
  o.notes,
  o.status,
  o.series_id is not null as is_recurring,
  v.type as vehicle_type,
  v.make as vehicle_make,
  v.model as vehicle_model,
  v.color as vehicle_color
from public.ride_offers o
join public.profiles p on p.id = o.driver_id
join public.vehicles v on v.id = o.vehicle_id
where o.college_id = public.auth_college_id()
  and o.recurring_days is null
  and o.status = 'open'
  and o.depart_at + make_interval(mins => o.flex_minutes) > now()
  and not p.is_banned;

create view public.requests_public
with (security_barrier = true)
as
select
  r.id,
  r.rider_id,
  r.college_id,
  split_part(btrim(p.full_name), ' ', 1) as rider_first_name,
  p.rating_avg as rider_rating_avg,
  p.rating_count as rider_rating_count,
  extensions.st_y(r.pickup_fuzzed::extensions.geometry) as pickup_lat,
  extensions.st_x(r.pickup_fuzzed::extensions.geometry) as pickup_lng,
  r.pickup_area,
  extensions.st_y(r.dest_fuzzed::extensions.geometry) as dest_lat,
  extensions.st_x(r.dest_fuzzed::extensions.geometry) as dest_lng,
  r.dest_area,
  r.window_start,
  r.window_end,
  r.seats_needed,
  r.women_only_pref,
  r.notes,
  r.status,
  r.series_id is not null as is_recurring
from public.ride_requests r
join public.profiles p on p.id = r.rider_id
where r.college_id = public.auth_college_id()
  and r.recurring_days is null
  and r.status = 'open'
  and r.window_end > now()
  and not p.is_banned;

revoke all on public.my_offers, public.my_requests, public.offers_public, public.requests_public
  from anon, authenticated;
grant select on public.my_offers, public.my_requests, public.offers_public, public.requests_public
  to authenticated;

-- Colleges: the new columns are not secret, but the API only needs these.
grant select on public.colleges to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The caller's own college with its settings and campus as plain numbers.
-- ---------------------------------------------------------------------------
create view public.my_college
with (security_invoker = true)
as
select
  c.id, c.name, c.short_name, c.city, c.country_code, c.timezone,
  c.cost_sharing_enabled, c.currency,
  extensions.st_y(c.campus_point::extensions.geometry) as campus_lat,
  extensions.st_x(c.campus_point::extensions.geometry) as campus_lng
from public.colleges c
where c.id = public.auth_college_id();

revoke all on public.my_college from anon, authenticated;
grant select on public.my_college to authenticated;
