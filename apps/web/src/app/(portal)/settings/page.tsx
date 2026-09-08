import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { Label } from "@/features/brand/components/Label";
import { outlinedButton, textButton } from "@/features/brand/cta";
import { loadAccountProfile } from "@/features/portal/server/identity";

export const metadata: Metadata = {
  title: "Settings — claveHQ",
  // Stays with the page it came from: an authenticated route has nothing for a search index.
  robots: { index: false, follow: false },
};

// The account behind the session — the profile row, the role grants, and the way out. Relocated
// here from `/dashboard`, which becomes Today, and still proving the three things it was written
// to prove end to end:
//
//   1. the session survives the redirect out of the sign-in action;
//   2. `public.users` resolves for the signed-in id, so `handle_new_user` ran;
//   3. the RLS policies let a user read their own profile and their own grants.
//
// The role chips are the *grants* as they are stored, which is not the same list as the
// capabilities the drawer gates on: `user_permission_keys` resolves deny overrides and super
// admin on top of these, and this page deliberately shows the rows rather than the resolution.
//
// `src/proxy.ts` and `app/(portal)/layout.tsx` have both already turned an unauthenticated
// request away. The check below is not redundant with either: a proxy can be bypassed by a
// misconfigured matcher, and a page that reads user data should not depend on another layer
// having run.
export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();

  // `getUser`, not `getSession`: it revalidates the token against the auth server rather than
  // trusting what the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect("/sign-in");
  }

  // The same read the app bar's avatar makes, memoised, so the one `public.users` row this
  // request needs is fetched once rather than once per component that wants a column of it.
  const profile = await loadAccountProfile(user.id);

  const { data: grants } = await supabase
    .from("user_roles")
    .select("roles(key, name), villages(name)")
    .eq("user_id", user.id);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      {/* Below `lg` the navigation drawer is not rendered, and the app bar's only link is the
          account avatar — which points here. Without this one, a phone user who reaches
          `/settings` has no way back into the portal but the browser's back button, and none at
          all if they arrived by bookmark or refreshed. The modal drawer that gives that viewport
          real navigation is a recorded gap outside this ticket (`NavigationDrawer.tsx`); a link
          back to the one page that exists is what keeps the door two-way until it lands. Hidden
          from `lg` up, where the drawer already carries Today. */}
      <Link href="/dashboard" className={`${textButton} mb-6 -ml-3 lg:hidden`}>
        Back to Today
      </Link>

      <div className="mb-5 max-w-[56ch]">
        <Label>Signed in</Label>
      </div>

      {/* An `<h2>` where the old page had an `<h1>`: the app bar in `(portal)/layout.tsx` carries
          the page's heading now, and a second `<h1>` would give the document two. */}
      <h2 className="headline-l text-on-surface">{profile?.full_name ?? user.email}</h2>

      <dl className="mt-9 grid max-w-[640px] grid-cols-1 gap-4 min-[560px]:grid-cols-2">
        <Fact term="Email" value={profile?.email ?? user.email ?? "—"} />
        <Fact term="Username" value={profile?.username ?? "Not set"} />
        <Fact term="Village" value={profile?.villages?.name ?? "Unassigned"} />
        <Fact term="Status" value={profile?.status ?? "—"} />
      </dl>

      <div className="mt-9 max-w-[640px]">
        <Label className="block">Roles</Label>
        {grants === null || grants.length === 0 ? (
          <p className="body-l mt-2.5 text-on-surface-variant">
            No roles granted yet. A village administrator assigns these.
          </p>
        ) : (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {grants.map((grant, index) => (
              <li
                key={`${grant.roles?.key ?? "role"}-${index}`}
                className="label-l min-h-8 rounded-s border border-outline px-3 py-1.5 break-words text-on-surface-variant"
              >
                {grant.roles?.name ?? "Unknown role"}
                {grant.villages?.name !== undefined && ` · ${grant.villages.name}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* A form and not a link: signing out changes server state, and a GET that mutates is
          followed by every prefetcher and link scanner that touches the page. */}
      <form action={signOutAction} className="mt-11">
        <button type="submit" className={`${outlinedButton} text-primary`}>
          Sign out
        </button>
      </form>
    </main>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-m bg-surface-container-low px-4 py-3.5">
      {/* `<dt>` wrapping the label rather than styling a bare span: inside a `<dl>`, a `<div>`
          may contain only `<dt>` and `<dd>`, and `Label` is a `<span>` by definition. */}
      <dt>
        <Label>{term}</Label>
      </dt>
      {/* No `nowrap` and no min-width: a long email in a ~320px cell wraps, which is the
          intended degradation. `break-words` stops one from overflowing its cell instead. */}
      <dd className="body-l mt-1 break-words text-on-surface">{value}</dd>
    </div>
  );
}
