import { expect, type Page } from "@playwright/test";

import { latestCodeFor } from "./mailpit";

/** Signs in through the UI with an emailed code. Ends on /onboarding or /home. */
export async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("College email").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page).toHaveURL(/\/verify$/);
  const code = await latestCodeFor(email);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/(onboarding|home)$/);
}

export async function completeOnboarding(page: Page, name = "Aisha Khan") {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill("050 123 4567");
  await page.getByLabel("student").check();
  await page.getByLabel(/I accept the/).check();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/home$/);
}
