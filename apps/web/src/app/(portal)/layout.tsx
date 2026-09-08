import { redirect } from "next/navigation";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { loadAuthzContext } from "@/features/authz/server/context";
import type { AuthzResult } from "@/features/authz/types";
import { outlinedButton } from "@/features/brand/cta";
import { NavigationDrawer } from "@/features/portal/components/NavigationDrawer";
import { ShellProvider } from "@/features/portal/components/ShellProvider";
import { TopAppBar } from "@/features/portal/components/TopAppBar";
import { loadAccountName } from "@/features/portal/server/identity";
import { materialSymbolsOutlined } from "../fonts";

/**
 * The portal shell: the 360px navigation drawer, the top app bar, and the gate in front of both.
 *
 * A route group, so `(portal)` contributes nothing to a URL — `/dashboard` and `/settings` keep
 * the paths they had, and `src/proxy.ts` (deny-by-default since ticket 0007) already guards them.
 *
 * A Server Component. `loadAuthzContext` is `cache()`-wrapped, so a page below calling it again
 * costs nothing, and the permission set reaches the drawer as a prop rather than through a
 * provider. **This layout runs once per full page load and not again on a soft navigation**, so
 * nothing derived from the current route is computed here: the two things that have to follow a
 * client-side navigation — the drawer's active row and the app bar's `<h1>` — read the URL for
 * themselves, in `components/DestinationLink.tsx` and `components/PageHeading.tsx`.
 *
 * `ShellProvider` is the shell's only client state — is the drawer collapsed, has the content
 * scrolled — and both the drawer and the app bar stay Server Components inside it, passing
 * through the client frames that read those two booleans as already-rendered payload. **That is
 * what keeps `permissions` out of the browser bundle**; see the note in `ShellProvider`.
 *
 * **Every route under here has to stay dynamic.** It is dynamic today because the session is
 * read from cookies, and the flat URLs are only safe on that basis: with the village resolved
 * from the session rather than from a `/v/[village]` segment, one `"use cache"` or one
 * `revalidate` added to a portal route would key a cache on a URL that does not name the tenant,
 * and serve one village's page to the next village's admin. RLS cannot catch that — it was
 * satisfied, for the first caller. `docs/FRONTEND.md` §1 states the rule.
 */
export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const result = await loadAuthzContext();

  // The proxy already turned an unauthenticated request away; this is the layer that does not
  // depend on the proxy's matcher having been right.
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return <PortalNotice status={result.status} />;
  }

  const { permissions, userId, village } = result.context;

  const accountName = await loadAccountName(userId);

  return (
    // `materialSymbolsOutlined.variable` is scoped here rather than added to the three faces on
    // <html>: the icon font is the portal's alone — nothing on `/` or `/sign-in` renders a glyph
    // — and a variable declared where it is used says so. It changes what the class defines, not
    // what the browser downloads: `app/fonts.ts` is imported by the root layout, so Next
    // preloads all four faces on every route either way.
    // `h-dvh` and not `min-h-dvh`: the shell is exactly one viewport tall and the *column* inside
    // `ShellProvider` scrolls, rather than the document. That is what the sticky app bar needs —
    // it sticks to its scroll container, and it has to be told when that container has moved,
    // which only an `onScroll` on the container itself can say. It is also why the drawer no
    // longer needs `sticky top-0` to stay put: nothing scrolls past it any more.
    <div className={`${materialSymbolsOutlined.variable} flex h-dvh bg-surface`}>
      <ShellProvider drawer={<NavigationDrawer village={village} permissions={permissions} />}>
        <TopAppBar accountName={accountName} />
        {/* Each page renders its own <main>: the app bar owns the <h1> and the landmark belongs
            to the content under it, not to the column that holds the chrome. */}
        {children}
      </ShellProvider>
    </div>
  );
}

/** The three answers that are not a portal, narrowed off `AuthzResult` so none can be forgotten. */
type PortalNoticeStatus = Exclude<AuthzResult["status"], "ok" | "signed-out">;

// `no-villages` is the ordinary case and not an edge one — `users.village_id` is nullable and a
// fresh Google sign-up has none until an administrator assigns one, so this is the first screen
// a new account sees. `no-access` is the resident whose village has not given them a role yet.
// `unavailable` is kept apart from both on purpose: an empty permission set and a failed read
// arrive as the same empty list, and collapsing them renders a database outage as "you have no
// permissions", which is wrong in the quietest possible way — it looks like a correct page.
const noticeCopy = {
  "no-villages": {
    heading: "You are not in a village yet",
    body:
      "Your account is fine — it has just not been added to a village. An administrator does " +
      "that, and the portal fills in the moment they have.",
  },
  "no-access": {
    heading: "Nothing has been assigned to you yet",
    body:
      "You are a member of a village, but no role has been granted to you in it. A village " +
      "administrator assigns those, and the portal opens as soon as one is.",
  },
  unavailable: {
    heading: "We could not reach your account",
    body:
      "Something went wrong reading your village and your permissions, so the portal is not " +
      "showing you a guess at either. Reload the page; if it keeps happening, the database is " +
      "the place to look.",
  },
} satisfies Record<PortalNoticeStatus, { heading: string; body: string }>;

/**
 * The portal with no shell around it, because in all three cases there is no village to scope a
 * drawer to and no permission set to draw one from.
 *
 * It carries the sign-out form for a reason: every one of these states is a dead end, and an
 * account stranded in one with no way out has to clear cookies by hand. A form and not a link —
 * see `signOutAction`'s call site in `/settings`.
 */
function PortalNotice({ status }: { status: PortalNoticeStatus }) {
  const { heading, body } = noticeCopy[status];

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-container-lowest px-[22px] py-12">
      <div className="w-full max-w-[400px] rounded-xl bg-surface-container-low p-6 shadow-[var(--md-elev-1)] min-[400px]:p-8">
        <span className="title-l text-on-surface">
          clave<em className="not-italic text-primary">HQ</em>
        </span>
        <h1 className="headline-s mt-6 text-on-surface">{heading}</h1>
        <p className="body-l mt-3 text-on-surface-variant">{body}</p>
        <form action={signOutAction} className="mt-8">
          <button type="submit" className={`${outlinedButton} text-primary`}>
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
