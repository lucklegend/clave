import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes apps/web/AGENTS.md and apps/web/CLAUDE.md on every run.
  // CLAUDE.md is user-owned and lives at the repo root, so keep the app free of both.
  agentRules: false,
};

export default nextConfig;
