import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes apps/web/AGENTS.md and apps/web/CLAUDE.md on every run.
  // CLAUDE.md is user-owned and lives at the repo root, so keep the app free of both.
  agentRules: false,
  // `@clavehq/shared` publishes TypeScript source rather than a build output, so there is no
  // build step to run before `apps/web` can consume it and no stale `dist/` to get out of sync.
  // Next has to compile it as part of the app instead.
  transpilePackages: ["@clavehq/shared"],
  // Response headers live here rather than in `src/proxy.ts` because that matcher deliberately
  // excludes `_next/static`, `_next/image` and the files a client fetches before it could hold a
  // session. An exclusion there is a decision to unguard a route, and header delivery must not
  // inherit that hole; headers configured here apply to every response, static assets included.
  //
  // The CSP carries `frame-ancestors` and nothing else, on purpose. Adding `script-src` to this
  // string without first plumbing a nonce blanks the site: the theme `<script>` in
  // `src/app/layout.tsx` is inlined into <head> with no nonce, and `/` is prerendered at build
  // time, so a per-request nonce can never reach that HTML file — the theme script and Next's
  // flight scripts would all be blocked, and the landing page would paint unhydrated.
  // `'unsafe-inline'` is not the way out of that. It is a header that looks like a CSP and
  // protects nothing, and it is ignored outright the moment a nonce or hash is present. The fix
  // is a nonce plumbed through to that tag, which is its own ticket.
  async headers() {
    return [
      {
        // `path*` is zero-or-more segments, so this matches `/` as well as everything under it.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Parity with `frame-ancestors` for agents that predate it. Nothing here frames itself.
          { key: "X-Frame-Options", value: "DENY" },
          // Already the modern browser default; setting it pins agents that default looser.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
