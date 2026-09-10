import { test as setup, expect } from "@playwright/test";

/**
 * Signs in once and saves the session for every other spec.
 *
 * The credentials are the local seed's own, written out in `supabase/seed.sql` and in version
 * control there for the reason that file records: a dev seed nobody can sign in to is not a seed.
 * They reach nothing but a local Supabase container.
 */
const AUTH_FILE = "e2e/.auth/admin.json";

setup("authenticate as the Villa Alpha admin", async ({ page }) => {
  await page.goto("/sign-in");

  await page.locator('input[name="identifier"]').fill("admin@villa-alpha.test");
  await page.locator('input[name="password"]').fill("clavehq-test-1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // The portal, whichever page it opens on — the assertion is that we left the form behind.
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 60_000 });
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
