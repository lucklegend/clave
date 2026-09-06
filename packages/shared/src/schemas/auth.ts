import { z } from "zod";

/**
 * Sign-in accepts either an email address or a username in one field, which is what the
 * form's "Email or username" placeholder promises. Which one it is gets decided by
 * {@link isEmailIdentifier} on the server, never by the shape of this schema: a stricter
 * schema here — `z.email().or(usernameSchema)` — would reject a typo'd address with a
 * *different* message than a wrong password, and that difference is enough to enumerate
 * which usernames exist.
 *
 * So the only thing validated here is presence and a sane length. Everything past that is
 * one indistinguishable "invalid credentials".
 */
export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    // 320 is the maximum length of an email address (64 local + @ + 255 domain). A username
    // is capped far shorter by the database's own CHECK constraint.
    .max(320, "That is too long to be an email address or a username.")
    .min(1, "Enter your email address or username."),
  password: z
    .string()
    // Deliberately no minimum beyond non-empty. The password *policy* belongs to sign-up;
    // applying it here would tell an attacker the length rule and would lock out any account
    // created before the rule changed.
    .min(1, "Enter your password.")
    .max(72, "That is too long to be a password."),
  // Unchecked boxes are absent from a submitted FormData, so the field must survive being
  // missing. See the cookie lifetime this drives in apps/web/src/features/auth/lib/server.ts.
  rememberMe: z.boolean().default(false),
});

export type SignInInput = z.input<typeof signInSchema>;
export type SignInFields = z.output<typeof signInSchema>;

/**
 * An `@` is the whole test, and it is the right one: `@` cannot appear in a username (the
 * `users_username_format` CHECK allows only `[a-z0-9._-]`), so the two spaces do not overlap
 * and no valid input is ambiguous. Anything containing `@` is handed to Supabase Auth as an
 * email and rejected there if malformed.
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}

/**
 * What the sign-in server action hands back to the form.
 *
 * A discriminated union rather than an optional-error object, so a caller that forgets to
 * check `ok` cannot read `fieldErrors` off a success. There is no `success` payload: on
 * success the action redirects and never returns.
 */
export type SignInFailure = {
  ok: false;
  /** Shown once, above the form, in a `role="alert"` region. */
  message: string;
  /**
   * Only ever populated by schema validation — an empty field, an over-long one. A rejected
   * *credential* never lands here, because naming the offending field would say whether the
   * account exists.
   */
  fieldErrors?: Partial<Record<keyof SignInFields, string>>;
};

export type SignInResult = SignInFailure;

/**
 * The single response for every rejected credential: unknown username, unknown email, wrong
 * password, suspended account. They must be indistinguishable in text, in field attribution
 * and in status, or the form becomes an oracle for which accounts exist.
 */
export const INVALID_CREDENTIALS_MESSAGE =
  "Those details did not match an account. Check them and try again.";
