import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes apps/web/AGENTS.md and apps/web/CLAUDE.md on every run.
  // CLAUDE.md is user-owned and lives at the repo root, so keep the app free of both.
  agentRules: false,
  // `@clavehq/shared` publishes TypeScript source rather than a build output, so there is no
  // build step to run before `apps/web` can consume it and no stale `dist/` to get out of sync.
  // Next has to compile it as part of the app instead.
  transpilePackages: ["@clavehq/shared"],
  // Two request-body caps live here, and they are **not** the same cap. `serverActions` is what
  // the action handler counts; `proxyClientMaxBodySize` is what the layer in front of it will
  // carry. Reading either one as "the" body limit is what put a crash on the compose form, so
  // both are written out together with the relationship between them stated.
  experimental: {
    serverActions: {
      // Next's default is 1 MB, which is below `ATTACHMENT_LIMITS.maxBytesTotal` (25 MiB) in
      // `packages/shared/src/schemas/announcements.ts` — so without this every real attachment
      // upload is refused by the framework's body parser before `saveAnnouncementAction` sees a
      // byte, and the person gets a stack trace instead of the pipeline's message.
      //
      // 56 MB rather than 25, because the cap that has to *speak* is `ATTACHMENT_LIMITS`, and a
      // rejection that names a file has to have read that file first. `prepareAttachments`
      // refuses a set on its total only after the whole set is in hand, so the largest body this
      // action must be able to read in order to refuse it is the largest set the per-file cap
      // admits — `maxFiles × maxBytesPerFile`, five files of 10 MiB, 50 MiB — plus the multipart
      // envelope around it: the part headers, the title, and a 20,000-character description.
      // Someone attaching five 9 MB documents is doing an ordinary thing and must get "All the
      // files together must be 25 MB or smaller", not a stack trace.
      //
      // Above that, nothing legitimate is being sent — every such body breaks the per-file cap or
      // the five-file cap on its own — and the framework's own 413 is the right answer at the
      // door.
      bodySizeLimit: "56mb",
    },
    // **Strictly larger than `serverActions.bodySizeLimit`, and that is the entire point of it.**
    //
    // `src/proxy.ts` is the session guard, and Next *clones the request body* for any route a
    // proxy runs on: one copy for the proxy, one buffered for the handler behind it. That clone
    // carries its own cap — this one, defaulting to 10 MB — and crossing it does not refuse the
    // request. It truncates the stream, logs a warning, and hands the handler a body that stops
    // mid-part. `serverActions.bodySizeLimit` never gets a say, because the action counts the
    // bytes it actually receives and a truncated body is exactly *at* the clone's cap rather than
    // over it. What that produced was `Error: Unexpected end of form` and the portal's generic
    // error page for every attachment past 10 MB — inside this feature's own advertised 10 MB
    // per-file allowance. The truncation itself is silent as far as the framework is concerned:
    // a `console.warn` on the server and nothing at all in the response, which is why it read as
    // a bug in the upload pipeline rather than as a limit nobody had set.
    //
    // Sitting above the action's limit is what keeps the action's limit the only cap that ever
    // speaks: a body big enough to be truncated here is still longer than `bodySizeLimit`, so the
    // action answers 413 rather than choking on a torn multipart envelope. Equal would not do —
    // truncation lands a body exactly *on* a cap, which is not over it, which is the bug again.
    //
    // The cost is memory, and it is real: the proxy buffers up to this much per in-flight request
    // that carries a body, on every path the matcher covers — `/sign-in` included, which is
    // reachable without a session. This is the number to revisit if that ever needs a bound of
    // its own; it cannot be scoped to one route from here.
    proxyClientMaxBodySize: "64mb",
  },
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
