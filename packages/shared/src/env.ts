import { z } from "zod";

// Publishable configuration only. Both values below are compiled into the browser bundle by
// design — the anon key is a public key whose whole security model is the Row-Level Security
// policies in `supabase/migrations`, not secrecy.
//
// The service-role key is deliberately absent from this file and from this package. It lives in
// `apps/web/src/features/auth/server/admin-client.ts` behind `import "server-only"`, because a
// module `apps/mobile` and every client component can import is exactly the wrong place to keep
// a key that bypasses RLS.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a full URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Reads and validates the public Supabase configuration.
 *
 * The two `process.env.NEXT_PUBLIC_*` reads are written out as literal member expressions and
 * must stay that way: Next replaces those exact texts with their values at build time, and any
 * indirection — destructuring `process.env`, a computed key, a loop over names — leaves
 * `undefined` in the browser bundle with no error at build time.
 *
 * Throws rather than returning a result, and does so at the call site rather than at module
 * load: a missing URL is a broken deployment, and the useful moment to say so is the first
 * request, with the variable named.
 */
export function readPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.message).join(" ");
    throw new Error(
      `Supabase is not configured. ${missing} Copy apps/web/.env.example to ` +
        "apps/web/.env.local and fill it in from the output of `pnpm supabase start`.",
    );
  }

  return parsed.data;
}
