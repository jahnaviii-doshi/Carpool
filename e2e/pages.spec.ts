import { expect, test } from "@playwright/test";

test("landing page explains the app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CampusPool/);
  await expect(page.getByRole("heading", { name: "CampusPool" })).toBeVisible();
  await expect(page.getByLabel("College email")).toBeVisible();
});

test("terms and privacy pages are public", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
  await expect(page.getByText(/Rides on CampusPool are free/)).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
});
