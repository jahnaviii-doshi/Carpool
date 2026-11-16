import { expect, test } from "@playwright/test";

test("landing page renders the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("CampusPool")).toBeVisible();
  await expect(page).toHaveTitle(/CampusPool/);
});
