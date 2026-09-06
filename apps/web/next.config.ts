import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes apps/web/AGENTS.md and apps/web/CLAUDE.md on every run.
  // CLAUDE.md is user-owned and lives at the repo root, so keep the app free of both.
  agentRules: false,
  // `@clavehq/shared` publishes TypeScript source rather than a build output, so there is no
  // build step to run before `apps/web` can consume it and no stale `dist/` to get out of sync.
  // Next has to compile it as part of the app instead.
  transpilePackages: ["@clavehq/shared"],
};

export default nextConfig;
