"use client";

import { useActionState, useId, useState } from "react";
import type { SignInResult } from "@clavehq/shared";
import { formGhostCta, formSolidCta } from "@/features/brand/cta";
import { signInAction, signInWithGoogleAction } from "../actions/sign-in";

type SignInFormProps = {
  /**
   * A failure carried in on the URL — the OAuth callback route redirects here with
   * `?error=oauth` when Google declines or the code exchange fails. Injected by the page rather
   * than read here, so this component has one source of truth for "what went wrong" and no
   * opinion about routing.
   */
  initialError?: string;
};

const fieldClasses =
  "min-h-[44px] w-full rounded-[2px] border border-muted bg-surface-2 px-3 text-[15px] " +
  "text-ink placeholder:text-muted transition-colors duration-[120ms] ease-[ease] " +
  "focus:border-accent focus:outline-none";

const labelClasses = "block font-mono text-[10.5px] tracking-[.13em] uppercase text-muted";

export function SignInForm({ initialError }: SignInFormProps) {
  // Two actions, one <form>. The Google button reaches its action through `formAction`, which
  // means the form's own fields — critically the "Remember me" checkbox — are submitted with it,
  // and an OAuth sign-in honours the checkbox exactly as a password sign-in does. Two separate
  // <form>s would have put the checkbox in only one of them.
  const [passwordState, submitPassword, isSubmittingPassword] = useActionState(signInAction, null);
  const [googleState, submitGoogle, isSubmittingGoogle] = useActionState(
    signInWithGoogleAction,
    null,
  );
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const identifierId = useId();
  const passwordId = useId();
  const rememberId = useId();
  const alertId = useId();
  const identifierErrorId = useId();
  const passwordErrorId = useId();

  // Whichever action last failed. Neither returns on success — both redirect — so at most one of
  // these is ever populated at a time.
  const result: SignInResult | null = passwordState ?? googleState;
  const message = result?.message ?? initialError;
  const identifierError = result?.fieldErrors?.identifier;
  const passwordError = result?.fieldErrors?.password;
  const isPending = isSubmittingPassword || isSubmittingGoogle;

  return (
    <form action={submitPassword} className="mt-7" noValidate>
      {/* Rendered only when there is something to say. An always-present live region would be
          announced as empty on load by some screen readers; `role="alert"` on a node that
          appears is announced when it appears. */}
      {message !== undefined && (
        <p
          id={alertId}
          role="alert"
          className="mb-5 rounded-[2px] border border-muted bg-surface px-3 py-2.5 text-[13.5px] text-ink-2"
        >
          {message}
        </p>
      )}

      <div className="grid gap-1.5">
        <label className={labelClasses} htmlFor={identifierId}>
          Email or username
        </label>
        <input
          id={identifierId}
          name="identifier"
          type="text"
          // `username` and not `email`: the field takes either, and telling a password manager it
          // is strictly an email makes it decline to fill a username.
          autoComplete="username"
          // Sign-in is the one place autofocus is right — it is why the reader opened the page.
          autoFocus
          required
          placeholder="you@example.com or your username"
          aria-invalid={identifierError !== undefined}
          aria-describedby={identifierError !== undefined ? identifierErrorId : undefined}
          className={fieldClasses}
        />
        {identifierError !== undefined && (
          <p id={identifierErrorId} className="text-[13px] text-ink-2">
            {identifierError}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-1.5">
        <label className={labelClasses} htmlFor={passwordId}>
          Password
        </label>
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={passwordError !== undefined}
            aria-describedby={passwordError !== undefined ? passwordErrorId : undefined}
            // Right padding clears the toggle, which is absolutely positioned over the field.
            className={`${fieldClasses} pr-[68px]`}
          />
          {/* A real <button type="button">, not an icon on a <div>: it is reachable by keyboard,
              it does not submit the form, and `aria-pressed` states which way it is set. The
              label stays "Show password" in both states so the accessible name is stable and
              only the pressed state changes — a name that flips to "Hide password" is announced
              as a different control. */}
          <button
            type="button"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-controls={passwordId}
            aria-pressed={isPasswordVisible}
            className="absolute inset-y-0 right-0 inline-flex min-h-[44px] items-center px-3 font-mono text-[10.5px] tracking-[.1em] uppercase text-muted transition-colors duration-[120ms] ease-[ease] hover:text-ink"
          >
            Show password
          </button>
        </div>
        {passwordError !== undefined && (
          <p id={passwordErrorId} className="text-[13px] text-ink-2">
            {passwordError}
          </p>
        )}
      </div>

      {/* The checkbox is the whole of "Remember me": it decides whether the session cookies this
          browser is about to receive are persistent (30 days) or expire when the browser closes.
          See `../lib/cookies.ts`. */}
      <div className="mt-4 flex items-center gap-2.5">
        <input id={rememberId} name="rememberMe" type="checkbox" className="size-4 accent-accent" />
        <label htmlFor={rememberId} className="text-[14px] text-ink-2">
          Remember me on this device
        </label>
      </div>

      <button type="submit" disabled={isPending} className={`${formSolidCta} mt-6`}>
        {isSubmittingPassword ? "Signing in…" : "Sign in"}
      </button>

      {/* The rules are the divider; the word sits between them. `aria-hidden` because "or" read
          aloud between two buttons describes nothing a reader cannot already tell from the
          buttons themselves. */}
      <div aria-hidden="true" className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule-strong" />
        <span className="font-mono text-[10.5px] tracking-[.13em] uppercase text-muted">or</span>
        <span className="h-px flex-1 bg-rule-strong" />
      </div>

      <button
        type="submit"
        formAction={submitGoogle}
        disabled={isPending}
        // The form is `noValidate`, but `formNoValidate` is set explicitly as well: without it a
        // browser that ignores the form-level attribute would refuse to run this action because
        // the `required` password field is empty — which it always is for an OAuth sign-in.
        formNoValidate
        className={formGhostCta}
      >
        <GoogleGlyph />
        {isSubmittingGoogle ? "Redirecting…" : "Continue with Google"}
      </button>
    </form>
  );
}

// Google's four-colour mark, inline so it is not a network request and not a CDN dependency.
// Fixed brand colours: it must not follow the theme, and it is `aria-hidden` because the button
// already says "Continue with Google".
function GoogleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
