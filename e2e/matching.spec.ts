import { expect, test, type Browser, type Page } from "@playwright/test";

import { uniqueEmail } from "./support/db";
import { completeOnboarding, signIn } from "./support/flows";

/** A date and time no other test uses, so parallel tests can't interfere. */
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(
  new Date(Date.now() + 3 * 24 * 3600 * 1000),
);

/** Unique first names per run, so leftover data from earlier runs can't match. */
const RUN = Math.random().toString(36).slice(2, 7);
const DRIVER = `Zainab${RUN}`;
const RIDER = `Quinn${RUN}`;
const OPPOSITE = `Olu${RUN}`;
const OUTSIDER = `Bilal${RUN}`;

async function userPage(browser: Browser, name: string, domain = "aus.edu"): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, uniqueEmail(name.split(" ")[0].toLowerCase(), domain));
  await completeOnboarding(page, name);
  return page;
}

async function choose(page: Page, field: string, query: string, result: RegExp) {
  await page.getByLabel(`Search ${field}`).fill(query);
  await page.getByRole("button", { name: result }).click();
}

async function postRequest(page: Page, from: [string, RegExp], to: [string, RegExp]) {
  await page.goto("/find");
  await choose(page, "pick me up at", ...from);
  await page.getByRole("button", { name: /Change going to/ }).click();
  await choose(page, "going to", ...to);
  await page.getByLabel("Date").fill(DAY);
  await page.getByLabel("Earliest").fill("05:50");
  await page.getByLabel("Latest").fill("06:40");
  await page.getByRole("button", { name: "Post my request" }).click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+\?saved=1$/);
}

test("riders on the driver's way see the driver, and vice versa", async ({ browser }) => {
  // Driver: Sahara Centre (Al Nahda) → AUS, in 3 days at 06:10 ± 15.
  const driver = await userPage(browser, `${DRIVER} Matchdriver`);
  await driver.goto("/vehicles/new?next=/offer");
  await driver.getByLabel("Make").fill("Toyota");
  await driver.getByLabel("Model").fill("Corolla");
  await driver.getByLabel("Colour").fill("White");
  await driver.getByLabel("Number plate").fill("SHJ 3 12345");
  await driver.getByRole("button", { name: "Save vehicle" }).click();
  await expect(driver).toHaveURL(/\/offer$/);
  await choose(driver, "leaving from", "sahara centre", /Sahara Centre/);
  await driver.getByRole("button", { name: /Change going to/ }).click();
  await choose(driver, "going to", "aus main gate", /AUS Main Gate/);
  await driver.getByLabel("Date").fill(DAY);
  await driver.getByLabel("Leaving at").fill("06:10");
  await driver.getByRole("button", { name: "Offer this ride" }).click();
  await expect(driver).toHaveURL(/\/offers\/[0-9a-f-]+\?saved=1$/);
  const offerUrl = driver.url().replace("?saved=1", "");

  // Rider on the way: Muwaileh → AUS, 05:50–06:40 the same day.
  const rider = await userPage(browser, `${RIDER} Matchrider`);
  await postRequest(rider, ["muwaileh", /Muwaileh Commercial/], ["aus main gate", /AUS Main Gate/]);
  const card = rider.getByTestId("driver-match").filter({ hasText: DRIVER });
  await expect(card).toHaveCount(1);
  await expect(card).not.toContainText("Matchdriver"); // first name only
  await expect(card).toContainText("White Toyota Corolla");
  await expect(card).toContainText("Al Nahda, Sharjah");
  await expect(card).toContainText(/Passes (under 1 km|about \d+(\.5)? km) from your pickup/);
  await expect(card).not.toContainText("Sahara Centre"); // exact label stays private
  // The driver appears on the map only as an approximate circle.
  await expect(rider.locator(".leaflet-container path.leaflet-interactive").first()).toBeVisible();

  // Driver now sees the rider.
  await driver.goto(offerUrl);
  const riderCard = driver.getByTestId("rider-match").filter({ hasText: RIDER });
  await expect(riderCard).toHaveCount(1);
  await expect(riderCard).toContainText("Muwaileh, Sharjah");

  // Rider going the other way: AUS → Al Nahda. No match.
  const opposite = await userPage(browser, `${OPPOSITE} Opposite`);
  await postRequest(
    opposite,
    ["aus main gate", /AUS Main Gate/],
    ["al nahda park", /Al Nahda Park/],
  );
  await expect(opposite.getByTestId("driver-match").filter({ hasText: DRIVER })).toHaveCount(0);

  // Rider from another college, same trip. No match.
  const outsider = await userPage(browser, `${OUTSIDER} Outsider`, "testcollege.example");
  await postRequest(
    outsider,
    ["muwaileh", /Muwaileh Commercial/],
    ["aus main gate", /AUS Main Gate/],
  );
  await expect(outsider.getByTestId("driver-match")).toHaveCount(0);

  // The driver sees neither the opposite-direction rider nor the outsider.
  await driver.reload();
  await expect(driver.getByTestId("rider-match").filter({ hasText: RIDER })).toHaveCount(1);
  await expect(driver.getByTestId("rider-match").filter({ hasText: OPPOSITE })).toHaveCount(0);
  await expect(driver.getByTestId("rider-match").filter({ hasText: OUTSIDER })).toHaveCount(0);
});

test("matches for someone else's request are not available", async ({ browser }) => {
  const owner = await userPage(browser, "Owner Person");
  await postRequest(owner, ["muwaileh", /Muwaileh Commercial/], ["aus main gate", /AUS Main Gate/]);
  const url = owner.url().replace("?saved=1", "");

  const snoop = await userPage(browser, "Snoop Person");
  const res = await snoop.goto(url);
  expect(res?.status()).toBe(404);
});
