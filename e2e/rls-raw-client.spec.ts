/**
 * Spec §5 required test, done literally: real users signed in with the raw
 * Supabase JS client (no UI, no server actions) try to read another
 * college's data. Every attempt must return 0 rows. Complements the pgTAP
 * suite in supabase/tests/030_rls_college_isolation.test.sql.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import type { Database } from "../lib/supabase/database.types";
import { uniqueEmail } from "./support/db";
import { latestCodeFor } from "./support/mailpit";

type Client = SupabaseClient<Database>;

async function signedInUser(email: string, name: string, phone: string) {
  const client: Client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const sent = await client.auth.signInWithOtp({ email });
  expect(sent.error).toBeNull();
  const verified = await client.auth.verifyOtp({
    email,
    token: await latestCodeFor(email),
    type: "email",
  });
  expect(verified.error).toBeNull();
  expect((await client.rpc("record_email_verification")).error).toBeNull();
  const onboard = await client.rpc("complete_onboarding", {
    p_full_name: name,
    p_phone_e164: phone,
    p_role: "student",
    p_accept_terms: true,
  });
  expect(onboard.error).toBeNull();
  return { client, id: verified.data.user!.id };
}

test.describe.configure({ mode: "serial" });

test("College A cannot read College B through the raw Supabase client", async () => {
  const a1 = await signedInUser(uniqueEmail("rls-a1"), "Aisha Khan", "+971501110001");
  const a2 = await signedInUser(uniqueEmail("rls-a2"), "Omar Ali", "+971501110002");
  const b1 = await signedInUser(
    uniqueEmail("rls-b1", "testcollege.example"),
    "Bilal Noor",
    "+971501110003",
  );

  // College B's profile: invisible in both the table and the public view.
  const bProfile = await a1.client.from("profiles").select("*").eq("id", b1.id);
  expect(bProfile.data).toEqual([]);
  const bPublic = await a1.client.from("profiles_public").select("*").eq("id", b1.id);
  expect(bPublic.data).toEqual([]);

  // No filter at all: still nothing from College B.
  const everyone = await a1.client.from("profiles_public").select("id, college_id");
  expect(everyone.data?.map((p) => p.id)).not.toContain(b1.id);
  expect(new Set(everyone.data?.map((p) => p.college_id)).size).toBe(1);

  // College B's phone number.
  const bContact = await a1.client.from("private_contacts").select("*").eq("user_id", b1.id);
  expect(bContact.data).toEqual([]);

  // Same college, no accepted booking: phone number still hidden.
  const aContact = await a1.client.from("private_contacts").select("*").eq("user_id", a2.id);
  expect(aContact.data).toEqual([]);
  const allContacts = await a1.client.from("private_contacts").select("user_id");
  expect(allContacts.data?.map((c) => c.user_id)).toEqual([a1.id]);

  // A same-college profile is visible, but only the narrow public projection.
  const aPublic = await a1.client.from("profiles_public").select("*").eq("id", a2.id).single();
  expect(aPublic.data?.first_name).toBe("Omar");
  expect(aPublic.data).not.toHaveProperty("gender");
  expect(aPublic.data).not.toHaveProperty("full_name");

  // Writes the client must not be able to make.
  const moveCollege = await a1.client
    .from("profiles")
    .update({ college_id: b1.id } as never)
    .eq("id", a1.id);
  expect(moveCollege.error).not.toBeNull();
  const insertContact = await a1.client
    .from("private_contacts")
    .insert({ user_id: a1.id, phone_e164: "+971500000000" });
  expect(insertContact.error).not.toBeNull();

  // Admin data.
  expect((await a1.client.from("college_requests").select("*")).data).toEqual([]);
  expect((await a1.client.from("super_admins" as never).select("*")).error).not.toBeNull();

  // Offers: A2 posts a ride. A1 (same college) sees only the fuzzed point and
  // the area; B1 (other college) sees nothing at all.
  const vehicle = await a2.client.rpc("save_vehicle", {
    p_type: "car",
    p_make: "Kia",
    p_model: "Rio",
    p_color: "Grey",
    p_seats: 3,
    p_plate_number: "SHJ 1 2345",
  });
  expect(vehicle.error).toBeNull();
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  const offer = await a2.client.rpc("save_ride_offer", {
    p_vehicle_id: vehicle.data!,
    p_origin_lat: 25.305,
    p_origin_lng: 55.37,
    p_origin_label: "Villa 12, Street 5, Al Nahda",
    p_origin_area: "Al Nahda, Sharjah",
    p_dest_lat: 25.312,
    p_dest_lng: 55.4905,
    p_dest_label: "AUS Main Gate",
    p_depart_local: `${tomorrow}T08:00:00`,
    p_seats_total: 2,
  });
  expect(offer.error).toBeNull();
  const offerId = offer.data!;

  const seen = await a1.client.from("offers_public").select("*").eq("id", offerId).single();
  expect(seen.data?.origin_area).toBe("Al Nahda, Sharjah");
  expect(seen.data).not.toHaveProperty("origin_label");
  expect(seen.data).not.toHaveProperty("origin_point");
  const offsetM = Math.hypot(
    (seen.data!.origin_lat! - 25.305) * 111_320,
    (seen.data!.origin_lng! - 55.37) * 111_320 * Math.cos((25.305 * Math.PI) / 180),
  );
  expect(offsetM).toBeGreaterThan(190);
  expect(offsetM).toBeLessThan(410);

  expect((await a1.client.from("ride_offers").select("*").eq("id", offerId)).data).toEqual([]);
  expect((await a1.client.from("my_offers").select("*").eq("id", offerId)).data).toEqual([]);
  expect((await a1.client.from("vehicle_plates").select("*")).data).toEqual([]);
  expect((await b1.client.from("offers_public").select("*").eq("id", offerId)).data).toEqual([]);
  expect((await b1.client.from("ride_offers").select("*").eq("id", offerId)).data).toEqual([]);

  // Direct writes are refused; only the RPCs can create rides.
  const direct = await a1.client.from("ride_offers").insert({} as never);
  expect(direct.error).not.toBeNull();
  const steal = await a1.client.rpc("cancel_ride_offer", { p_id: offerId });
  expect(steal.error).not.toBeNull();

  // Mirror: College B sees nothing from AUS.
  const fromB = await b1.client.from("profiles_public").select("id").in("id", [a1.id, a2.id]);
  expect(fromB.data).toEqual([]);
});
