"use client";

import { useActionState, useId, useState } from "react";
import type { SignInResult } from "@clavehq/shared";
import { filledButton, iconButton, outlinedButton } from "@/features/brand/cta";
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

// M3's outlined text field is a 56px input carrying its own 1px `outline` border, with the label
// absolutely positioned into a notch in that border. Outlined and not filled: a filled field on
// a `surface-container-low` card would need a fourth surface tone to sit apart from it.
//
// Functions rather than constants because the invalid state repaints the border and the label
// together. Both fields call both functions, so identifier and password are painted by the same
// code — an error on one can never look different from an error on the other. That matters here:
// a field-level error is only ever a schema failure (`../actions/sign-in` returns `fieldErrors`
// from Zod alone), never a rejected credential, and identical paint is what keeps it that way.
//
// D4 rule 1: `outline` is the token for a component boundary. `outline-variant` fails 3:1 by
// design and belongs on dividers.
//
// `focus:outline-none` is deliberate, not an oversight: the 1px -> 2px `border` change above is
// the focus indicator for these two fields, replacing the ring `@layer base` draws everywhere
// else, and a ring on top of it would double up on the field's own boundary. `forced-colors:` is
// added back because Windows High Contrast forces `border-color` to one system colour in both
// states, so the hue half of the border indicator disappears and only the 1px->2px width change
// would remain — these being the two most security-relevant controls in the app, that is not a
// state worth guessing works.
function fieldClasses(hasError: boolean) {
  return (
    "h-14 w-full rounded-xs border bg-transparent px-4 body-l text-on-surface " +
    "placeholder:text-on-surface-variant transition-colors duration-[120ms] " +
    "ease-[cubic-bezier(0.2,0,0,1)] focus:outline-none forced-colors:focus:outline " +
    "group-focus-within:border-2 " +
    (hasError ? "border-error" : "border-outline group-focus-within:border-primary")
  );
}

// The notch fill is the card's own background, so `bg-surface-container-low` here is coupled to
// the card in `app/sign-in/page.tsx` — change one and the label paints a stripe of the wrong
// tone across the border it sits in.
function labelClasses(hasError: boolean) {
  return (
    "absolute -top-2 left-3 px-1 bg-surface-container-low body-s " +
    (hasError ? "text-error" : "text-on-surface-variant group-focus-within:text-primary")
  );
}

// Supporting text sits at the field's own 16px text inset rather than at the box edge.
const supportingTextClasses = "mt-1 px-4 body-s text-error";

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
          appears is announced when it appears.

          One fill for every failure. A rejected credential, a schema failure, a suspended
          account and an OAuth error all render here, in `error-container`, in this position —
          distinguishing them by paint would be the same account-enumeration oracle as
          distinguishing them by copy. */}
      {message !== undefined && (
        <p
          id={alertId}
          role="alert"
          className="mb-5 rounded-xs bg-error-container px-4 py-3 body-m text-on-error-container"
        >
          {message}
        </p>
      )}

      {/* `group` so the label and the border light up together on `focus-within`. Keyed off the
          wrapper rather than the input's own `:focus` because the password field's reveal button
          is part of the field's anatomy and sits inside this box — on the input's `:focus` alone,
          reaching that button would drop the field back to its resting border while the caret is
          still in it. */}
      <div className="group relative">
        <label className={labelClasses(identifierError !== undefined)} htmlFor={identifierId}>
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
          className={fieldClasses(identifierError !== undefined)}
        />
      </div>
      {identifierError !== undefined && (
        <p id={identifierErrorId} className={supportingTextClasses}>
          {identifierError}
        </p>
      )}

      <div className="group relative mt-6">
        <label className={labelClasses(passwordError !== undefined)} htmlFor={passwordId}>
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type={isPasswordVisible ? "text" : "password"}
          autoComplete="current-password"
          required
          aria-invalid={passwordError !== undefined}
          aria-describedby={passwordError !== undefined ? passwordErrorId : undefined}
          // Right padding clears the 48px toggle, inset 4px from the field's edge.
          className={`${fieldClasses(passwordError !== undefined)} pr-[56px]`}
        />
        {/* A real <button type="button">, not an icon on a <div>: it is reachable by keyboard,
            it does not submit the form, and `aria-pressed` states which way it is set. The
            label stays "Show password" in both states so the accessible name is stable and
            only the pressed state changes — a name that flips to "Hide password" is announced
            as a different control. The control went from a text button to an M3 icon button, so
            that name now travels on `aria-label` rather than on the button's text.

            48x48 outright, which is M3's icon-button spec and clears this repo's 44px floor
            without the `m3-target` expansion the 40px buttons need (D1). `iconButton` states no
            radius — its other caller, the theme toggle, pins 24px so its press can morph — so the
            full round this one rests at is stated here. */}
        <button
          type="button"
          onClick={() => setIsPasswordVisible((visible) => !visible)}
          aria-controls={passwordId}
          aria-pressed={isPasswordVisible}
          aria-label="Show password"
          title="Show password"
          className={`${iconButton} absolute top-1/2 right-1 -translate-y-1/2 rounded-full`}
        >
          <EyeGlyph />
        </button>
      </div>
      {passwordError !== undefined && (
        <p id={passwordErrorId} className={supportingTextClasses}>
          {passwordError}
        </p>
      )}

      {/* The checkbox is the whole of "Remember me": it decides whether the session cookies this
          browser is about to receive are persistent (30 days) or expire when the browser closes.
          See `../lib/cookies.ts`. The native control keeps its semantics and takes the theme
          through `accent-color`; an M3 checkbox drawn as a <span> overlay would trade those
          semantics for a tick mark. */}
      <div className="mt-5 flex items-center gap-2.5">
        <input
          id={rememberId}
          name="rememberMe"
          type="checkbox"
          className="size-[18px] accent-primary"
        />
        <label htmlFor={rememberId} className="body-m">
          Remember me on this device
        </label>
      </div>

      <button type="submit" disabled={isPending} className={`${filledButton} mt-7 w-full`}>
        {isSubmittingPassword ? "Signing in…" : "Sign in"}
      </button>

      {/* The rules are the divider; the word sits between them. `aria-hidden` because "or" read
          aloud between two buttons describes nothing a reader cannot already tell from the
          buttons themselves. `outline-variant` and not `outline`: this is a decorative hairline,
          not a component boundary (D4 rule 1). */}
      <div aria-hidden="true" className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-outline-variant" />
        <span className="label-m text-on-surface-variant">or</span>
        <span className="h-px flex-1 bg-outline-variant" />
      </div>

      <button
        type="submit"
        formAction={submitGoogle}
        disabled={isPending}
        // The form is `noValidate`, but `formNoValidate` is set explicitly as well: without it a
        // browser that ignores the form-level attribute would refuse to run this action because
        // the `required` password field is empty — which it always is for an OAuth sign-in.
        formNoValidate
        // `outlinedButton` states no label colour, so this one is stated here:
        // `on-surface`, not the `primary` the hero and the closing block use, so the label reads
        // as a neutral sentence beside Google's own mark rather than in the brand green. The
        // state layer mixes `currentColor` and follows it.
        className={`${outlinedButton} w-full gap-3 text-on-surface`}
      >
        <GoogleGlyph />
        {isSubmittingGoogle ? "Redirecting…" : "Continue with Google"}
      </button>
    </form>
  );
}

// Material Symbols' `visibility`, on the 24-box grid the M3 icon set uses, painted at 20px inside
// the 48px button. `aria-hidden` because the button is already named.
function EyeGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  );
}

// Google's four-colour mark, inline so it is not a network request and not a CDN dependency.
// Fixed brand colours: it must not follow the theme, and it is `aria-hidden` because the button
// already says "Continue with Google".
function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
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
