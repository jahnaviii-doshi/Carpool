begin;
\ir _helpers.psql
select plan(44);

create temp table ids as
select pg_temp.create_onboarded_user('driver@aus.edu', '+971501000001', 'Dana Driver') as driver,
       pg_temp.create_onboarded_user('rider@aus.edu', '+971501000002', 'Rami Rider') as rider,
       pg_temp.create_onboarded_user('woman@aus.edu', '+971501000003', 'Wafa Woman') as woman;
update public.profiles set gender = 'female' where id = (select woman from ids);
grant select on ids to authenticated;

-- ---- Vehicles ----------------------------------------------------------------
select pg_temp.login_as((select driver from ids));
select throws_ok(
  $$ select public.save_vehicle('bike', 'Honda', 'CBR', 'Red', 2, 'SHJ 1 111') $$,
  '22023', null, 'a bike has exactly one passenger seat');
select throws_ok(
  $$ select public.save_vehicle('car', 'Toyota', 'Corolla', 'White', 3, '!!') $$,
  '22023', null, 'plate number is validated');
select throws_ok(
  $$ select public.save_vehicle('car', 'Toyota', 'Corolla', 'White', 9, 'SHJ 1 111') $$,
  '23514', null, 'at most 7 passenger seats');
select lives_ok(
  $$ select public.save_vehicle('car', 'Toyota', 'Corolla', 'White', 3, 'shj  3   12345') $$,
  'driver adds a car');
select is((select plate_number from public.vehicle_plates), 'SHJ 3 12345', 'plate is normalised');
select is((select college_id from public.vehicles),
          (select college_id from public.profiles where id = (select driver from ids)),
          'vehicle college_id comes from the owner');
select throws_ok($$ insert into public.vehicles (owner_id, college_id, type, make, model, color, seats)
                    values (auth.uid(), gen_random_uuid(), 'car', 'a', 'b', 'c', 1) $$,
  '42501', null, 'vehicles cannot be inserted directly');

-- ---- Offers ------------------------------------------------------------------
create temp table o as
select public.save_ride_offer(
  p_vehicle_id => (select id from public.vehicles limit 1),
  p_origin_lng => 55.3700, p_origin_lat => 25.3050, p_origin_label => 'Villa 12, Street 5, Al Nahda',
  p_origin_area => 'Al Nahda',
  p_dest_lng => 55.4905, p_dest_lat => 25.3120, p_dest_label => 'AUS Main Gate',
  p_depart_local => pg_temp.dubai_local(1, '08:15'),
  p_seats_total => 2) as id;
grant select on o to authenticated;

select is((select seats_available from public.ride_offers where id = (select id from o)), 2,
  'seats_available starts at seats_total');
select is(
  (select depart_at from public.ride_offers where id = (select id from o)),
  pg_temp.dubai_local(1, '08:15') at time zone 'Asia/Dubai',
  'departure is interpreted in Dubai time and stored as UTC');
select ok(
  (select extensions.st_distance(origin_point, origin_fuzzed) between 199 and 401
   from public.ride_offers where id = (select id from o)),
  'origin is fuzzed by 200–400 m');
select ok(
  (select extensions.st_distance(dest_point, dest_fuzzed) between 199 and 401
   from public.ride_offers where id = (select id from o)),
  'destination is fuzzed by 200–400 m too');

select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.37, p_origin_lat => 25.305, p_origin_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(-1), p_seats_total => 1) $$,
  '22023', null, 'departure in the past is rejected');
select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.37, p_origin_lat => 25.305, p_origin_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(1), p_seats_total => 4) $$,
  '22023', null, 'seats cannot exceed the vehicle');
select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.4905, p_origin_lat => 25.3121, p_origin_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(1), p_seats_total => 1) $$,
  '22023', null, 'start and destination must differ');
select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 2.35, p_origin_lat => 48.85, p_origin_label => 'Paris',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(1), p_seats_total => 1) $$,
  '22023', null, 'points far from campus are rejected');
select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.37, p_origin_lat => 25.305, p_origin_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(1), p_seats_total => 1, p_cost_per_seat => 10) $$,
  '22023', null, 'cost sharing is refused at a UAE college');
select throws_ok(
  $$ select public.save_ride_offer(
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.37, p_origin_lat => 25.305, p_origin_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_depart_local => pg_temp.dubai_local(1), p_seats_total => 1, p_women_only => true) $$,
  '22023', null, 'only women can post women-only rides');

-- Editing keeps the fuzz stable (same user, same place → same fuzzed point).
create temp table before_edit as
select origin_fuzzed from public.ride_offers where id = (select id from o);
select lives_ok(
  $$ select public.save_ride_offer(
       p_id => (select id from o),
       p_vehicle_id => (select id from public.vehicles limit 1),
       p_origin_lng => 55.3700, p_origin_lat => 25.3050, p_origin_label => 'Villa 12, Street 5, Al Nahda',
       p_origin_area => 'Al Nahda',
       p_dest_lng => 55.4905, p_dest_lat => 25.3120, p_dest_label => 'AUS Main Gate',
       p_depart_local => pg_temp.dubai_local(1, '08:30'), p_seats_total => 3, p_notes => 'Leaving on time') $$,
  'driver edits the offer');
select ok(
  (select extensions.st_equals(o2.origin_fuzzed::extensions.geometry, b.origin_fuzzed::extensions.geometry)
   from public.ride_offers o2, before_edit b where o2.id = (select id from o)),
  'fuzzed point is stable across edits');
select is((select seats_available from public.ride_offers where id = (select id from o)), 3,
  'seats_available follows seats_total on edit');

-- ---- Public view: what another user sees -------------------------------------
select pg_temp.login_as((select rider from ids));
select is((select count(*)::int from public.ride_offers), 0, 'rider cannot read offers table');
select is((select origin_area from public.offers_public where id = (select id from o)), 'Al Nahda',
  'rider sees the coarse area');
select ok(
  (select extensions.st_distance(
      extensions.st_makepoint(origin_lng, origin_lat)::extensions.geography,
      extensions.st_makepoint(55.3700, 25.3050)::extensions.geography) between 199 and 401
   from public.offers_public where id = (select id from o)),
  'rider sees only the fuzzed point');
select is((select driver_first_name from public.offers_public where id = (select id from o)), 'Dana',
  'rider sees driver first name');
select is((select vehicle_model from public.offers_public where id = (select id from o)), 'Corolla',
  'rider sees vehicle model');
select hasnt_column('public', 'offers_public', 'origin_label', 'offers_public has no exact label');
select hasnt_column('public', 'offers_public', 'origin_point', 'offers_public has no exact point');
select hasnt_column('public', 'offers_public', 'plate_number', 'offers_public has no plate');
select hasnt_column('public', 'requests_public', 'pickup_label', 'requests_public has no exact label');
select throws_ok($$ select public.cancel_ride_offer((select id from o)) $$, 'P0002', null,
  'another user cannot cancel the offer');

-- ---- Requests ---------------------------------------------------------------
select throws_ok(
  $$ select public.save_ride_request(
       p_pickup_lng => 55.45, p_pickup_lat => 25.30, p_pickup_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_date => (now() at time zone 'Asia/Dubai')::date + 1,
       p_window_start => '09:00', p_window_end => '08:00') $$,
  '22023', null, 'window end must be after start');
select throws_ok(
  $$ select public.save_ride_request(
       p_pickup_lng => 55.45, p_pickup_lat => 25.30, p_pickup_label => 'A',
       p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'B',
       p_date => (now() at time zone 'Asia/Dubai')::date + 1,
       p_window_start => '07:00', p_window_end => '08:00', p_women_only_pref => true) $$,
  '22023', null, 'women-only preference is for women riders');
select lives_ok($$ select pg_temp.post_request(auth.uid()) $$, 'rider posts a request');
select pg_temp.login_as((select rider from ids));
select ok(
  (select extensions.st_distance(pickup_point, pickup_fuzzed) between 199 and 401 from public.ride_requests),
  'pickup is fuzzed by 200–400 m');

-- ---- Recurring series --------------------------------------------------------
select pg_temp.login_as((select woman from ids));
select lives_ok($$ select public.save_vehicle('car', 'Kia', 'Picanto', 'Blue', 2, 'DXB A 1') $$,
  'woman adds a car');
create temp table series as
select public.save_ride_offer(
  p_vehicle_id => (select id from public.vehicles limit 1),
  p_origin_lng => 55.40, p_origin_lat => 25.33, p_origin_label => 'Al Majaz',
  p_dest_lng => 55.4905, p_dest_lat => 25.312, p_dest_label => 'AUS',
  p_depart_local => pg_temp.dubai_local(1, '07:45'), p_seats_total => 2,
  p_recurring_days => array[1, 2, 3, 4, 5],
  p_recurring_until => (now() at time zone 'Asia/Dubai')::date + 60,
  p_women_only => true) as id;
grant select on series to authenticated;

select ok(
  (select count(*) between 9 and 11 from public.ride_offers where series_id = (select id from series)),
  'a weekday series becomes ~10 dated rides in the next 14 days');
select ok(
  (select bool_and(extract(dow from depart_at at time zone 'Asia/Dubai') between 1 and 5
                   and (depart_at at time zone 'Asia/Dubai')::time = '07:45')
   from public.ride_offers where series_id = (select id from series)),
  'each date is a weekday at 07:45 Dubai time');
select is((select women_only from public.ride_offers where series_id = (select id from series) limit 1), true,
  'dates inherit the series settings');

select pg_temp.login_as((select rider from ids));
select is((select count(*)::int from public.offers_public where id = (select id from series)), 0,
  'the series template itself is never public');
select ok((select count(*) > 0 from public.offers_public where is_recurring and women_only),
  'its dated rides are public');

select pg_temp.login_as((select woman from ids));
select lives_ok($$ select public.cancel_ride_offer((select id from series)) $$, 'cancel the series');
select is(
  (select count(*)::int from public.ride_offers where series_id = (select id from series) and status = 'open'),
  0, 'cancelling a series cancels its future dates');

-- ---- Limits -------------------------------------------------------------------
select pg_temp.logout();
update public.app_settings set max_posts_per_day = 1;  -- rider already posted one today
select pg_temp.login_as((select rider from ids));
select throws_ok($$ select pg_temp.post_request(auth.uid()) $$, '54000', null,
  'daily posting limit is enforced');

select pg_temp.logout();
update public.profiles set is_banned = true where id = (select driver from ids);
select pg_temp.login_as((select driver from ids));
select throws_ok(
  $$ select public.save_vehicle('car', 'Nissan', 'Sunny', 'Grey', 3, 'SHJ 2 2') $$,
  '42501', null, 'a banned user cannot add vehicles');

select pg_temp.logout();
select * from finish();
rollback;
