import Link from "next/link";
import { iconButton } from "@/features/brand/cta";

type AccountButtonProps = {
  /** The signed-in person's display name, or `null` when there is nothing to draw initials from. */
  name: string | null;
};

/**
 * The app bar's trailing control: a 48×48 target with M3's 40×40 avatar inside it.
 *
 * **It is a link to `/settings`, and that is load-bearing rather than decorative.** `/settings`
 * is the account page — profile, role grants and the sign-out form — and the drawer has no row
 * pointing at it: the drawer's "Settings" is the unbuilt village-settings module, a different
 * screen behind a different gate. Without this link the only way to sign out would be to type
 * the URL.
 *
 * `iconButton` states no radius, so this call site states the one it wants, exactly as
 * `ThemeToggle` beside it does. The focus ring stays the global `primary`: the ring is drawn
 * around the 48px box at a 2px offset, so it lands on `surface` and never on the avatar's
 * `primary-container` — which is the one fill `docs/decisions/0001-material-3.md` D4 says
 * `primary` cannot clear, and the reason `.focus-on-container` exists for the cases where it
 * does land there.
 */
export function AccountButton({ name }: AccountButtonProps) {
  const initials = name === null ? "" : initialsOf(name);

  return (
    <Link
      href="/settings"
      // The name is in the accessible name because the initials are not one: "AA" read aloud is
      // not an account, and a portal a person holds grants in two villages of is a portal worth
      // being sure which account you are in.
      aria-label={name === null ? "Your account" : `Your account — ${name}`}
      className={`${iconButton} rounded-full`}
    >
      <span className="label-l flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        {initials}
      </span>
    </Link>
  );
}

/**
 * One or two letters from a display name.
 *
 * The name reaching this is whatever the profile had — a full name, a username or an email
 * address — so this takes the first letter of the first word and, only when there is more than
 * one word, the first of the last. `alpha_admin` gives "A" rather than a guess at where a
 * username's second word starts.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words.at(0)?.at(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.at(0) ?? "") : "";

  return `${first}${last}`.toUpperCase();
}
