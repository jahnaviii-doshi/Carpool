import { expect, test, type Page } from "@playwright/test";

import { sql, uniqueEmail } from "./support/db";
import { completeOnboarding, signIn } from "./support/flows";

async function newUser(page: Page, name: string) {
  const email = uniqueEmail(name.split(" ")[0].toLowerCase());
  await signIn(page, email);
  await completeOnboarding(page, name);
  return email;
}

async function addVehicle(page: Page) {
  await page.getByLabel("Make").fill("Toyota");
  await page.getByLabel("Model").fill("Corolla");
  await page.getByLabel("Colour").fill("White");
  await page.getByLabel("Passenger seats").fill("3");
  await page.getByLabel("Number plate").fill("shj 3 12345");
  await page.getByRole("button", { name: "Save vehicle" }).click();
}

test.describe("offering a ride", () => {
  test("driver adds a car, offers, edits and cancels a ride", async ({ page }) => {
    const email = await newUser(page, "Dana Driver");

    await page.getByRole("link", { name: "Offer a ride" }).click();
    await expect(page.getByText("Add your vehicle first.")).toBeVisible();
    await page.getByRole("link", { name: "Add a vehicle →" }).click();
    await addVehicle(page);
    await expect(page).toHaveURL(/\/offer$/);

    // Validation: no starting point yet.
    await page.getByRole("button", { name: "Offer this ride" }).click();
    await expect(page.getByText("Choose the starting point.")).toBeVisible();

    // Search for the start; destination defaults to campus.
    await page.getByLabel("Search leaving from").fill("sahara centre");
    await page.getByRole("button", { name: /Sahara Centre, Al Nahda/ }).click();
    await expect(page.getByTestId("origin-chosen")).toContainText("Others see: Al Nahda, Sharjah");
    await expect(page.getByTestId("dest-chosen")).toContainText("AUS campus");
    await page.getByLabel("Seats").fill("2");
    await page.getByRole("button", { name: "Offer this ride" }).click();

    await expect(page).toHaveURL(/\/rides\?saved=offer$/);
    const card = page.getByTestId("my-offer");
    await expect(card).toContainText("Al Nahda, Sharjah");
    await expect(card).toContainText("2/2 free");

    // Stored with fuzzed points 200–400 m away from the real ones.
    const [row] = await sql<{ origin_m: number; dest_m: number }>(
      `select extensions.st_distance(origin_point, origin_fuzzed) as origin_m,
              extensions.st_distance(dest_point, dest_fuzzed) as dest_m
         from public.ride_offers o join auth.users u on u.id = o.driver_id
        where u.email = $1`,
      [email],
    );
    expect(row.origin_m).toBeGreaterThanOrEqual(199);
    expect(row.origin_m).toBeLessThanOrEqual(401);
    expect(row.dest_m).toBeGreaterThanOrEqual(199);

    // Edit seats.
    await card.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Seats").fill("3");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("my-offer")).toContainText("3/3 free");

    // Cancel.
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("my-offer").getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/cancelled=1/);
    await expect(page.getByTestId("my-offer")).toHaveCount(0);
  });
});

test.describe("asking for a ride", () => {
  test("rider picks a pickup on the map and posts a weekday request", async ({ page }) => {
    await newUser(page, "Rami Rider");
    await page.getByRole("link", { name: "Find a ride" }).click();

    // Pick the pickup point by tapping the map.
    await page.getByRole("button", { name: "Pick on map" }).first().click();
    const map = page.locator(".leaflet-container").first();
    await expect(map).toBeVisible();
    await map.click({ position: { x: 120, y: 120 } });
    await expect(page.getByTestId("pickup-chosen")).toContainText("Pinned location");

    await page.getByLabel("Earliest").fill("07:30");
    await page.getByLabel("Latest").fill("08:30");
    await page.getByLabel("I need this every week").check();
    await page.getByRole("button", { name: "Post my request" }).click();

    await expect(page).toHaveURL(/\/rides\?saved=request$/);
    await expect(page.getByRole("heading", { name: "Repeating" })).toBeVisible();
    await expect(page.getByText(/Mon–Fri, 07:30–08:30/)).toBeVisible();
    // Dated requests were created for the coming weekdays.
    expect(await page.getByTestId("my-request").count()).toBeGreaterThan(0);
  });

  test("the time window must end after it starts", async ({ page }) => {
    await newUser(page, "Sara Student");
    await page.goto("/find");
    await page.getByLabel("Search pick me up at").fill("muwaileh");
    await page.getByRole("button", { name: /Muwaileh Commercial/ }).click();
    await page.getByLabel("Earliest").fill("09:00");
    await page.getByLabel("Latest").fill("08:00");
    await page.getByRole("button", { name: "Post my request" }).click();
    await expect(page.getByText("The latest time must be after the earliest time.")).toBeVisible();
  });
});

test("signed-out users cannot open ride pages", async ({ page }) => {
  for (const path of ["/offer", "/find", "/rides", "/vehicles"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
});

test("address search needs a signed-in user", async ({ request }) => {
  const res = await request.get("/api/geocode?q=sharjah");
  expect(res.status()).toBe(401);
});
