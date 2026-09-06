"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  INVALID_CREDENTIALS_MESSAGE,
  isEmailIdentifier,
  signInSchema,
  type SignInFailure,
  type SignInResult,
} from "@clavehq/shared";
import { REMEMBER_COOKIE, rememberMarkerOptions } from "../lib/cookies";
import { createSupabaseServerClient } from "../lib/server";
import { resolveUsernameToEmail } from "../server/resolve-identifier";

/**
 * Handed to Supabase Auth when a username matched no account.
 *
 * The point is *not* the address — it is that an unknown username and an unknown email now take
 * the same path through GoTrue, and therefore roughly the same time. Returning early on an
 * unresolved username would make "no such username" measurably faster than "wrong password",
 * which is the enumeration oracle the uniform error message exists to close.
 *
 * `.invalid` is reserved by RFC 2606 and can never be registered, so this cannot collide with a
 * real account.
 */
const UNRESOLVABLE_EMAIL = "unresolved-identifier@clavehq.invalid";

const SIGNED_IN_DESTINATION = "/dashboard";

/**
 * Signs a user in with an email address or a username, plus a password.
 *
 * Shaped for `useActionState`, so it takes the previous state and returns the next one. On
 * success it does not return at all — `redirect` throws — which is why the return type has no
 * success variant.
 */
export async function signInAction(
  _previous: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    // An unchecked checkbox is simply absent from FormData; a checked one submits "on".
    rememberMe: formData.get("rememberMe") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the fields below.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const { identifier, password, rememberMe } = parsed.data;

  const cookieStore = await cookies();
  // Written *before* the sign-in call, because that call is what makes Supabase set the session
  // cookies, and `../lib/server.ts` reads this marker at that moment to decide their lifetime.
  cookieStore.set(REMEMBER_COOKIE, rememberMe ? "1" : "0", rememberMarkerOptions(rememberMe));

  const email = isEmailIdentifier(identifier)
    ? identifier
    : ((await resolveUsernameToEmail(identifier)) ?? UNRESOLVABLE_EMAIL);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Every rejection lands here with the same message: unknown username, unknown email, wrong
  // password, malformed address. They must stay indistinguishable — including in which field
  // the message is attached to, which is why none of them sets `fieldErrors`.
  if (error !== null || data.user === null) {
    return { ok: false, message: INVALID_CREDENTIALS_MESSAGE };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();

  // A suspended account gets a different, specific message on purpose. The password was correct,
  // so the person has already proved the account exists — there is nothing left to conceal, and
  // "invalid credentials" would send them to reset a password that works.
  //
  // `invited` is allowed through: it marks a row an admin created ahead of the person, and
  // someone signing in with a working password is exactly who that row was for.
  if (profile === null || profile.status === "suspended") {
    await supabase.auth.signOut();

    return {
      ok: false,
      message:
        profile === null
          ? "This account has no profile yet. Ask your village administrator to set one up."
          : "This account is suspended. Contact your village administrator.",
    };
  }

  redirect(SIGNED_IN_DESTINATION);
}

/**
 * Starts the Google OAuth handshake.
 *
 * The browser is sent to Google by Supabase, and Google returns to Supabase's own
 * `/auth/v1/callback` — not to Next. Only after that does Supabase bounce to `redirectTo`,
 * which is this app's `/auth/callback` route.
 */
export async function signInWithGoogleAction(
  _previous: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const rememberMe = formData.get("rememberMe") === "on";

  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, rememberMe ? "1" : "0", rememberMarkerOptions(rememberMe));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await requestOrigin()}/auth/callback` },
  });

  if (error !== null || data.url === null) {
    return {
      ok: false,
      message:
        "Google sign-in is not available. Check that the Google client ID and secret are set — " +
        "see apps/web/.env.example.",
    };
  }

  redirect(data.url);
}

/**
 * The origin this request arrived on, used to build the OAuth return URL.
 *
 * A forwarded header is attacker-controllable behind a misconfigured proxy, so this deliberately
 * does *not* trust one for the redirect target on its own: Supabase only honours a `redirectTo`
 * that appears in `additional_redirect_urls` in `supabase/config.toml`. That allow-list is the
 * control; this function only picks which allowed origin to come back to.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return `${protocol}://${host}`;
}

/**
 * The first issue per field, keyed by field name.
 *
 * Walks `issues` rather than going through `z.flattenError`, whose `fieldErrors` is only as
 * typed as the `ZodError` generic it is handed — and re-stating that generic here would mean
 * naming the schema's input type twice and keeping the two in step by hand. Matching the path
 * segment against a literal narrows to exactly the two keys the union declares, with nothing
 * asserted.
 */
function toFieldErrors(error: z.ZodError): SignInFailure["fieldErrors"] {
  const result: NonNullable<SignInFailure["fieldErrors"]> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;

    // First issue wins: a field with two problems has one message, and it is the first thing
    // wrong with it rather than the last.
    if (field === "identifier" && result.identifier === undefined) {
      result.identifier = issue.message;
    }

    if (field === "password" && result.password === undefined) {
      result.password = issue.message;
    }
  }

  return result;
}
