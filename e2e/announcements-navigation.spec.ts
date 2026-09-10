import { test, expect } from "@playwright/test";

/**
 * Client navigation around the announcements board.
 *
 * Every assertion here is about a *soft* navigation — a real click on a real link, with the
 * pointer moving onto it first, because that is what a person does and it is the only path the
 * bug this file exists for ever appeared on. A hard load of the same URLs always worked, which
 * is exactly what made the failure look like a caching fault for two days.
 */

// Located by href, not by accessible name: an announcement can be *titled* "New Announcement",
// and a role+name lookup then matches both the button and that row. Ask for the one thing that
// cannot collide — the destination.

/**
 * Hover, let the pointer rest, then click.
 *
 * The dwell is load-bearing rather than defensive. `<Link>` prefetches on hover, and an
 * intercepting route only ever renders from that prefetched payload — so a click delivered in the
 * same tick as the hover races the prefetch and lands on the un-intercepted route instead. A
 * person's hand always dwells; `locator.click()` does not, which is why this bug reproduces by
 * hand and vanished under a naive spec.
 */
async function hoverThenClick(locator: import("@playwright/test").Locator) {
  await locator.hover();
  await locator.page().waitForTimeout(1_000);
  await locator.click();
}

const composeLink = (page: import("@playwright/test").Page) =>
  page.locator('a[href="/announcements/new"]');

/** The row titles in the board's body, never its header. */
const firstRowTitle = (page: import("@playwright/test").Page) =>
  page.getByRole("table").locator("tbody a").first();

test.describe("announcements board", () => {
  test("clicking New announcement renders the compose form", async ({ page }) => {
    await page.goto("/announcements");
    await expect(page.getByRole("table")).toBeVisible();

    // `click()` moves the pointer onto the link before pressing, so the `<Link>` prefetch fires
    // exactly as it does for a person. Dispatching the event directly skips that, and skipping it
    // is what made this bug look fixed when it was not.
    await hoverThenClick(composeLink(page));

    await expect(page).toHaveURL(/\/announcements\/new$/);
    // The form, not the board: the failure mode is that the URL moves and the board stays.
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("clicking an announcement title opens it in a dialog over the board", async ({ page }) => {
    await page.goto("/announcements");

    await hoverThenClick(firstRowTitle(page));

    await expect(page).toHaveURL(/\/announcements\/view\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("dialog")).toBeVisible();
    // The board stays mounted underneath — that is the whole point of the intercepted route.
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("the compose page renders on a hard load", async ({ page }) => {
    await page.goto("/announcements/new");

    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("an announcement renders as a full page on a hard load", async ({ page }) => {
    await page.goto("/announcements");
    const href = await firstRowTitle(page).getAttribute("href");
    expect(href).not.toBeNull();

    await page.goto(href ?? "");

    // No interception on a hard load, so no dialog and no board — just the page.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});

/**
 * The order the bug actually needs.
 *
 * Opening an announcement puts a subtree into the `@modal` slot, and a parallel slot keeps its
 * last rendered subtree when the router moves to a sibling the slot's own pattern does not match
 * — the behaviour `features/portal/components/Modal.tsx` documents for the edit page. A fresh tab
 * that goes straight to the compose page never has that state, which is why this reproduces by
 * hand and passes in a clean spec.
 */
test.describe("announcements board, after the modal slot has been used", () => {
  test("New announcement still renders the compose form", async ({ page }) => {
    await page.goto("/announcements");

    // Put something in the `@modal` slot.
    await hoverThenClick(page.getByRole("table").locator("tbody a").first());
    await expect(page).toHaveURL(/\/announcements\/view\/[0-9a-f-]{36}$/);

    // Back to the board, the way a reader dismisses what they just opened.
    await page.goBack();
    await expect(page).toHaveURL(/\/announcements$/);
    await expect(page.getByRole("table")).toBeVisible();

    // Now the compose page, from a router that has slot state to reconcile.
    await hoverThenClick(page.locator('a[href="/announcements/new"]'));

    await expect(page).toHaveURL(/\/announcements\/new$/);
    await expect(page.getByRole("textbox", { name: "Title" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});
