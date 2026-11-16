import { expect, test } from "@playwright/test";

import { sql, uniqueEmail } from "./support/db";
import { completeOnboarding, signIn } from "./support/flows";
import { countEmailsTo } from "./support/mailpit";

test.describe("sign-in gate", () => {
  test("a personal email is rejected and no code is sent", async ({ page }) => {
    const email = uniqueEmail("someone", "gmail.com");
    await page.goto("/");
    await page.getByLabel("College email").fill(email);
    await page.getByRole("button", { name: "Send me a code" }).click();

    await expect(page.getByText(/gmail\.com is a personal email provider/)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(await countEmailsTo(email)).toBe(0);
  });

  test("an unknown college gets a request link, prefilled", async ({ page }) => {
    const email = uniqueEmail("dean", "newcollege.example");
    await page.goto("/");
    await page.getByLabel("College email").fill(email);
    await page.getByRole("button", { name: "Send me a code" }).click();

    await expect(page.getByText(/isn't on CampusPool yet/)).toBeVisible();
    expect(await countEmailsTo(email)).toBe(0);

    await page.getByRole("link", { name: "Request it →" }).click();
    await expect(page.getByLabel("Your college email")).toHaveValue(email);
    await expect(page.getByLabel("College email domain(s)")).toHaveValue("newcollege.example");

    await page.getByLabel("College name").fill("New College");
    await page.getByLabel("City").fill("Ajman");
    await page.getByRole("button", { name: "Request my college" }).click();
    await expect(page.getByText(/We'll review your request/)).toBeVisible();
  });

  test("a look-alike domain is not treated as AUS", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("College email").fill(uniqueEmail("x", "fakeaus.edu"));
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByText(/isn't on CampusPool yet/)).toBeVisible();
  });

  test("invalid input shows inline errors without a round trip", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("College email").fill("not-an-email");
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  });

  test("signed-out users are sent to sign in", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("AUS student", () => {
  test("signs in with a code, onboards, and lands on home", async ({ page }) => {
    const email = uniqueEmail("g000");
    await signIn(page, email);

    await expect(page.getByTestId("verified-college")).toHaveText(
      "Verified: American University of Sharjah",
    );
    // Onboarding validation is inline.
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("You need to accept the Terms and Privacy Policy.")).toBeVisible();

    await completeOnboarding(page, "Aisha Khan");
    await expect(page.getByRole("heading", { name: "Hi Aisha" })).toBeVisible();
    await expect(page.getByText("American University of Sharjah")).toBeVisible();

    const [row] = await sql<{ college: string; phone: string }>(
      `select c.short_name as college, pc.phone_e164 as phone
         from auth.users u
         join public.profiles p on p.id = u.id
         join public.colleges c on c.id = p.college_id
         join public.private_contacts pc on pc.user_id = p.id
        where u.email = $1`,
      [email],
    );
    expect(row).toEqual({ college: "AUS", phone: "+971501234567" });

    // Signed-in users skip the landing page.
    await page.goto("/");
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a wrong code is rejected", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("College email").fill(uniqueEmail("wrongcode"));
    await page.getByRole("button", { name: "Send me a code" }).click();
    await expect(page).toHaveURL(/\/verify$/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByText("That code is wrong or has expired.")).toBeVisible();
  });

  test("an overdue user sees the re-verification banner", async ({ page }) => {
    const email = uniqueEmail("overdue");
    await signIn(page, email);
    await completeOnboarding(page, "Omar Ali");
    await sql(
      `update public.profiles set email_verified_at = now() - interval '200 days'
        where id = (select id from auth.users where email = $1)`,
      [email],
    );
    await page.reload();
    await expect(page.getByText("Confirm you're still at your college")).toBeVisible();
  });
});

test.describe("super admin", () => {
  test("approves a college request, which opens sign-in for that domain", async ({ page }) => {
    const adminEmail = uniqueEmail("admin");
    const domain = `uni-${Date.now()}.example`;
    await sql("insert into public.super_admins (email) values ($1)", [adminEmail]);
    await sql(
      `insert into public.college_requests (email, college_name, city, domains)
       values ($1, $2, 'Ajman', array[$3]::public.dns_name[])`,
      [`dean@${domain}`, `E2E University ${domain}`, domain],
    );

    await signIn(page, adminEmail);
    await completeOnboarding(page, "Admin Person");
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const card = page.locator('[data-slot="card"]').filter({ hasText: `E2E University ${domain}` });
    await card.getByLabel("Short name").fill("E2E");
    await card.getByRole("button", { name: "Approve and add college" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `E2E University ${domain} is now on CampusPool.`,
    );
    await expect(card).toHaveCount(0);

    const [row] = await sql<{ college_id: string | null }>(
      "select public.college_for_email($1) as college_id",
      [`student@${domain}`],
    );
    expect(row.college_id).not.toBeNull();
  });

  test("a normal user cannot open the admin panel", async ({ page }) => {
    await signIn(page, uniqueEmail("notadmin"));
    await completeOnboarding(page, "Normal Student");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/home$/);
  });
});
