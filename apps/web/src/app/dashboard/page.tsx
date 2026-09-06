import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Label } from "@/features/landing/components/Label";
import { compactGhostCta } from "@/features/brand/cta";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { createSupabaseServerClient } from "@/features/auth/lib/server";

export const metadata: Metadata = {
  title: "Dashboard — claveHQ",
  robots: { index: false, follow: false },
};

// A deliberate stub, and the place the real admin portal goes. It exists to prove three things
// end to end, which is why it renders them rather than a welcome message:
//
//   1. the session survives the redirect out of the sign-in action;
//   2. `public.users` resolves for the signed-in id, so `handle_new_user` ran;
//   3. the RLS policies let a user read their own profile and their own grants.
//
// `src/proxy.ts` already redirects an unauthenticated request away from `/dashboard`. The
// check below is not redundant with it: a proxy can be bypassed by a misconfigured matcher,
// and a page that reads user data should not depend on another layer having run.
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // `getUser`, not `getSession`: it revalidates the token against the auth server rather than
  // trusting what the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("email, username, full_name, status, villages(name, slug, tier)")
    .eq("id", user.id)
    .maybeSingle();

  const { data: grants } = await supabase
    .from("user_roles")
    .select("roles(key, name), villages(name)")
    .eq("user_id", user.id);

  return (
    <main className="mx-auto max-w-[1180px] px-[22px] pt-11 pb-14">
      <div className="mb-5 flex max-w-[56ch] items-center gap-2.5">
        <Label>Signed in</Label>
        <span className="h-px flex-1 bg-rule-strong" />
      </div>

      <h1 className="text-[clamp(27px,4vw,42px)] font-bold tracking-[-0.035em]">
        {profile?.full_name ?? user.email}
      </h1>
      <p className="mt-4 max-w-[56ch] text-[16.5px] text-ink-2">
        The portal itself is not built yet. This page confirms the session, the profile row and the
        role grants all resolve — the next milestone drops the real modules in here.
      </p>

      {/* 1px grid lines are the container's own background showing through the gap, as on the
          landing page's KPI block. */}
      <dl className="mt-9 grid max-w-[640px] grid-cols-1 gap-px border border-rule bg-rule min-[560px]:grid-cols-2">
        <Fact term="Email" value={profile?.email ?? user.email ?? "—"} />
        <Fact term="Username" value={profile?.username ?? "Not set"} />
        <Fact term="Village" value={profile?.villages?.name ?? "Unassigned"} />
        <Fact term="Status" value={profile?.status ?? "—"} />
      </dl>

      <div className="mt-9 max-w-[640px]">
        <Label className="block">Roles</Label>
        {grants === null || grants.length === 0 ? (
          <p className="mt-2.5 text-[15px] text-ink-2">
            No roles granted yet. A village administrator assigns these.
          </p>
        ) : (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {grants.map((grant, index) => (
              <li
                key={`${grant.roles?.key ?? "role"}-${index}`}
                className="rounded-[2px] border border-rule-strong px-2.5 py-1.5 font-mono text-[11px] tracking-[.06em] uppercase text-ink-2"
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
        <button type="submit" className={compactGhostCta}>
          Sign out
        </button>
      </form>
    </main>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="bg-paper px-[13px] py-3">
      {/* `<dt>` wrapping the label rather than styling a bare span: inside a `<dl>`, a `<div>`
          may contain only `<dt>` and `<dd>`, and `Label` is a `<span>` by definition. */}
      <dt>
        <Label>{term}</Label>
      </dt>
      {/* No `nowrap` and no min-width: a long email in a ~320px cell wraps, which is the
          intended degradation. `break-words` stops one from overflowing its cell instead. */}
      <dd className="mt-[3px] text-[15px] break-words">{value}</dd>
    </div>
  );
}
