-- Milestone 4: matching.
--
-- find_matches_for_request(request_id) and find_matches_for_offer(offer_id)
-- apply the hard rules (spec §6.1–6.6) in SQL and return candidates with a
-- few metrics. Ranking happens in lib/matching/score.ts.
--
-- Privacy: results contain only what offers_public / requests_public already
-- show (fuzzed points, area, first name, vehicle summary) plus two metrics.
-- The detour distance is rounded to 500 m so repeated searches cannot be
-- used to reconstruct someone's exact route or address.

alter table public.app_settings
  add column match_pickup_radius_m int not null default 1500 check (match_pickup_radius_m between 100 and 10000),
  add column match_dest_radius_m int not null default 2000 check (match_dest_radius_m between 100 and 10000),
  add column match_limit int not null default 30 check (match_limit between 1 and 100);

-- ---------------------------------------------------------------------------
-- Blocks (spec §4). Matching and (Milestone 5) bookings respect them in both
-- directions. The block/unblock UI arrives in Milestone 6.
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
-- You can see whom you blocked, never who blocked you.
create policy "read own blocks" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());

create function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Geometry helpers
-- ---------------------------------------------------------------------------

-- The line a driver follows: their road route if known, else the straight
-- line from origin to destination.
create function public.offer_line(
  p_route extensions.geography,
  p_origin extensions.geography,
  p_dest extensions.geography
)
returns extensions.geometry
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_route::extensions.geometry,
    extensions.st_makeline(p_origin::extensions.geometry, p_dest::extensions.geometry)
  );
$$;

-- Hard rules 4 and 5: the pickup is near the line, and the drop-off is either
-- near the driver's destination or near the line *further along* than the
-- pickup (so a rider is never matched against the direction of travel).
create function public.route_fits(
  p_line extensions.geometry,
  p_offer_dest extensions.geography,
  p_pickup extensions.geography,
  p_dropoff extensions.geography,
  p_pickup_radius_m int,
  p_dest_radius_m int
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extensions.st_dwithin(p_pickup, p_line::extensions.geography, p_pickup_radius_m)
     and (
       extensions.st_dwithin(p_dropoff, p_offer_dest, p_dest_radius_m)
       or (
         extensions.st_dwithin(p_dropoff, p_line::extensions.geography, p_pickup_radius_m)
         and extensions.st_linelocatepoint(p_line, p_dropoff::extensions.geometry)
           > extensions.st_linelocatepoint(p_line, p_pickup::extensions.geometry)
       )
     );
$$;

-- Hard rule 3: the departure, plus or minus flexibility, overlaps the
-- rider's window (inclusive at both ends).
create function public.time_fits(
  p_depart timestamptz,
  p_flex_minutes int,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_depart - make_interval(mins => p_flex_minutes) <= p_window_end
     and p_depart + make_interval(mins => p_flex_minutes) >= p_window_start;
$$;

-- Minutes the driver would have to shift to land inside the window (0 if
-- the planned departure is already inside it).
create function public.time_gap_minutes(
  p_depart timestamptz,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_depart between p_window_start and p_window_end then 0
    else round(least(
      abs(extract(epoch from p_depart - p_window_start)),
      abs(extract(epoch from p_depart - p_window_end))
    ) / 60)::int
  end;
$$;

-- Public detour figure: rounded to 500 m.
create function public.rounded_detour_m(p_point extensions.geography, p_line extensions.geometry)
returns int
language sql
immutable
set search_path = ''
as $$
  select (round(extensions.st_distance(p_point, p_line::extensions.geography) / 500) * 500)::int;
$$;

revoke execute on function
  public.offer_line(extensions.geography, extensions.geography, extensions.geography),
  public.route_fits(extensions.geometry, extensions.geography, extensions.geography,
    extensions.geography, int, int),
  public.time_fits(timestamptz, int, timestamptz, timestamptz),
  public.time_gap_minutes(timestamptz, timestamptz, timestamptz),
  public.rounded_detour_m(extensions.geography, extensions.geometry)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Drivers for a rider's request
-- ---------------------------------------------------------------------------
create function public.find_matches_for_request(p_request_id uuid)
returns table (
  offer_id uuid,
  driver_id uuid,
  driver_first_name text,
  driver_rating_avg numeric,
  driver_rating_count int,
  vehicle_type public.vehicle_type,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  origin_area text,
  origin_lat double precision,
  origin_lng double precision,
  dest_area text,
  dest_lat double precision,
  dest_lng double precision,
  depart_at timestamptz,
  flex_minutes int,
  seats_available int,
  women_only boolean,
  is_recurring boolean,
  notes text,
  detour_m int,
  time_gap_minutes int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.ride_requests;
  v_tz text;
  v_settings public.app_settings;
  v_rider_gender public.gender;
  v_length interval;
begin
  -- Only the rider can match their own request (rule 1: same college is
  -- also re-checked against the caller).
  select * into r from public.ride_requests where id = p_request_id and rider_id = auth.uid();
  if not found or r.college_id is distinct from public.auth_college_id() then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.status <> 'open' then
    return;
  end if;

  select c.timezone into v_tz from public.colleges c where c.id = r.college_id;
  select * into v_settings from public.app_settings;
  select p.gender into v_rider_gender from public.profiles p where p.id = r.rider_id;
  v_length := r.window_end - r.window_start;

  return query
  with candidates as (
    select
      o.*,
      d.full_name as driver_full_name,
      d.rating_avg as d_rating_avg,
      d.rating_count as d_rating_count,
      v.type as v_type, v.make as v_make, v.model as v_model, v.color as v_color,
      public.offer_line(o.route, o.origin_point, o.dest_point) as line,
      -- A repeating request is compared on the offer's own date, using the
      -- request's local time of day (weekday + time-of-day matching).
      case when r.recurring_days is null then r.window_start
           else ((o.depart_at at time zone v_tz)::date + (r.window_start at time zone v_tz)::time)
                at time zone v_tz
      end as ws
    from public.ride_offers o
    join public.profiles d on d.id = o.driver_id
    join public.vehicles v on v.id = o.vehicle_id
    where o.college_id = r.college_id                                -- rule 1
      and o.recurring_days is null                                   -- dated rides only
      and o.status = 'open'                                          -- rule 2
      and o.seats_available >= r.seats_needed
      and o.depart_at > now()
      and o.driver_id <> r.rider_id
      and not d.is_banned
      and (not o.women_only or v_rider_gender = 'female')            -- rule 6
      and (not r.women_only_pref or d.gender = 'female')
      and not public.is_blocked_between(o.driver_id, r.rider_id)
      and (
        r.recurring_days is null
        or (
          extract(dow from o.depart_at at time zone v_tz)::int = any (r.recurring_days)
          and (o.depart_at at time zone v_tz)::date
              between (r.window_start at time zone v_tz)::date and r.recurring_until
        )
      )
  )
  select
    c.id,
    c.driver_id,
    split_part(btrim(c.driver_full_name), ' ', 1),
    c.d_rating_avg,
    c.d_rating_count,
    c.v_type, c.v_make, c.v_model, c.v_color,
    c.origin_area,
    extensions.st_y(c.origin_fuzzed::extensions.geometry),
    extensions.st_x(c.origin_fuzzed::extensions.geometry),
    c.dest_area,
    extensions.st_y(c.dest_fuzzed::extensions.geometry),
    extensions.st_x(c.dest_fuzzed::extensions.geometry),
    c.depart_at,
    c.flex_minutes,
    c.seats_available,
    c.women_only,
    c.series_id is not null,
    c.notes,
    public.rounded_detour_m(r.pickup_point, c.line),
    public.time_gap_minutes(c.depart_at, c.ws, c.ws + v_length)
  from candidates c
  where public.time_fits(c.depart_at, c.flex_minutes, c.ws, c.ws + v_length)          -- rule 3
    and public.route_fits(c.line, c.dest_point, r.pickup_point, r.dest_point,          -- rules 4, 5
          v_settings.match_pickup_radius_m, v_settings.match_dest_radius_m)
  order by
    extensions.st_distance(r.pickup_point, c.line::extensions.geography),
    c.depart_at
  limit v_settings.match_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Riders for a driver's offer (mirror image)
-- ---------------------------------------------------------------------------
create function public.find_matches_for_offer(p_offer_id uuid)
returns table (
  request_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_rating_avg numeric,
  rider_rating_count int,
  pickup_area text,
  pickup_lat double precision,
  pickup_lng double precision,
  dest_area text,
  dest_lat double precision,
  dest_lng double precision,
  window_start timestamptz,
  window_end timestamptz,
  seats_needed int,
  women_only_pref boolean,
  is_recurring boolean,
  notes text,
  detour_m int,
  time_gap_minutes int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.ride_offers;
  v_tz text;
  v_settings public.app_settings;
  v_driver_gender public.gender;
  v_line extensions.geometry;
begin
  select * into o from public.ride_offers where id = p_offer_id and driver_id = auth.uid();
  if not found or o.college_id is distinct from public.auth_college_id() then
    raise exception 'ride not found' using errcode = 'P0002';
  end if;
  if o.status <> 'open' then
    return;
  end if;

  select c.timezone into v_tz from public.colleges c where c.id = o.college_id;
  select * into v_settings from public.app_settings;
  select p.gender into v_driver_gender from public.profiles p where p.id = o.driver_id;
  v_line := public.offer_line(o.route, o.origin_point, o.dest_point);

  return query
  with candidates as (
    select
      r.*,
      p.full_name as rider_full_name,
      p.rating_avg as p_rating_avg,
      p.rating_count as p_rating_count,
      -- A repeating offer is compared on the request's own date, using the
      -- offer's local departure time.
      case when o.recurring_days is null then o.depart_at
           else ((r.window_start at time zone v_tz)::date + (o.depart_at at time zone v_tz)::time)
                at time zone v_tz
      end as dep
    from public.ride_requests r
    join public.profiles p on p.id = r.rider_id
    where r.college_id = o.college_id                                -- rule 1
      and r.recurring_days is null                                   -- dated requests only
      and r.status = 'open'
      and r.seats_needed <= o.seats_available                        -- rule 2
      and r.window_end > now()
      and r.rider_id <> o.driver_id
      and not p.is_banned
      and (not o.women_only or p.gender = 'female')                  -- rule 6
      and (not r.women_only_pref or v_driver_gender = 'female')
      and not public.is_blocked_between(o.driver_id, r.rider_id)
      and (
        o.recurring_days is null
        or (
          extract(dow from r.window_start at time zone v_tz)::int = any (o.recurring_days)
          and (r.window_start at time zone v_tz)::date
              between (o.depart_at at time zone v_tz)::date and o.recurring_until
        )
      )
  )
  select
    c.id,
    c.rider_id,
    split_part(btrim(c.rider_full_name), ' ', 1),
    c.p_rating_avg,
    c.p_rating_count,
    c.pickup_area,
    extensions.st_y(c.pickup_fuzzed::extensions.geometry),
    extensions.st_x(c.pickup_fuzzed::extensions.geometry),
    c.dest_area,
    extensions.st_y(c.dest_fuzzed::extensions.geometry),
    extensions.st_x(c.dest_fuzzed::extensions.geometry),
    c.window_start,
    c.window_end,
    c.seats_needed,
    c.women_only_pref,
    c.series_id is not null,
    c.notes,
    public.rounded_detour_m(c.pickup_point, v_line),
    public.time_gap_minutes(c.dep, c.window_start, c.window_end)
  from candidates c
  where c.dep > now()
    and public.time_fits(c.dep, o.flex_minutes, c.window_start, c.window_end)          -- rule 3
    and public.route_fits(v_line, o.dest_point, c.pickup_point, c.dest_point,         -- rules 4, 5
          v_settings.match_pickup_radius_m, v_settings.match_dest_radius_m)
  order by
    extensions.st_distance(c.pickup_point, v_line::extensions.geography),
    c.window_start
  limit v_settings.match_limit;
end;
$$;

revoke execute on function public.find_matches_for_request(uuid), public.find_matches_for_offer(uuid)
  from public, anon;
grant execute on function public.find_matches_for_request(uuid), public.find_matches_for_offer(uuid)
  to authenticated;
