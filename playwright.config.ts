import { defineConfig, devices } from "@playwright/test";

/**
 * The repo's first test runner, added because `typecheck`, `lint` and a full production build
 * all passed while `/announcements/new` was broken for every mouse user.
 *
 * That is not a gap those tools can close. The bug lived in how Next resolved a *client*
 * navigation, so the only thing that could see it was a real browser clicking a real link —
 * which is why this is Playwright and not a unit-test runner. Two merged pull requests went out
 * green before anyone clicked the button.
 *
 * **It builds and serves production, and reuses nothing.** That is not caution, it is the only
 * configuration that can see the bug this suite was written for. `next dev` does not prefetch a
 * `<Link>` on hover, and an intercepting route only ever renders from the prefetched payload — so
 * under a dev server the interception never fires, the compose page works, and the specs below
 * pass against code that is broken for every real user. They were verified doing exactly that.
 * Pointing this at a dev server would turn the whole suite into false confidence, so
 * `reuseExistingServer` stays off even though it costs a build per run.
 */
export default defineConfig({
  testDir: "./e2e",
  // Serial, single worker: every spec drives the same seeded village through the same session,
  // so parallel runs would race each other's data rather than test anything.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm --filter web build && pnpm --filter web start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
