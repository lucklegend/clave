import { notFound, redirect } from "next/navigation";
import { AnnouncementView } from "@/features/announcements/components/AnnouncementView";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";
import { Modal } from "@/features/portal/components/Modal";

/**
 * Reading an announcement without leaving the board: `/announcements/[id]` intercepted into the
 * `@modal` slot, so the board stays mounted underneath and the dialog opens over it.
 *
 * `(.)` matches the segment at the *same* level as this slot's parent — `announcements/[id]` — and
 * the interception only applies to a soft navigation from inside this layout. A pasted link, a new
 * tab or a reload is a hard load, which Next does not intercept: those get `[id]/page.tsx`, the
 * same view as a full page. One URL, two renderings, and the difference is how you arrived.
 *
 * **This is a route, and it inherits none of the board's checks.** Being drawn over the board is a
 * fact about layout, not about authorisation — a request for this URL is served by this file
 * whether or not anything else on the page was ever gated. So the gate is repeated here in full,
 * and it is the same gate for the same reason `(portal)/announcements/page.tsx` gives at length:
 * `announcements.create`, not `.read`, because `.read` is seeded to every role, and `notFound()`
 * rather than a refusal so the route does not confirm its own existence to someone who cannot
 * use it.
 *
 * No `"use cache"` and no `revalidate`, here or anywhere under `(portal)`: village scope is
 * resolved per request from the session, so a cache key that does not name the tenant would serve
 * one village's announcement to another village's admin — a breach RLS never sees, because RLS
 * was satisfied for the first caller (ADR 0002 D3, `docs/FRONTEND.md` §1).
 */
export default async function InterceptedAnnouncementPage({
  params,
}: PageProps<"/announcements/[id]">) {
  const result = await loadAuthzContext();

  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return null;
  }

  const { permissions } = result.context;

  if (!can(permissions, "announcements.create")) {
    notFound();
  }

  const { id } = await params;

  return (
    // `returnHref` is where dismissal lands if there is no history entry behind the dialog. See
    // `Modal` for why that is close to unreachable and closed off anyway.
    //
    // The label is the dialog's kind rather than the announcement's title: the title is the first
    // heading inside the body and is read immediately after the name, and the body is rendered by
    // the server component below — which this client leaf, by design, cannot see into.
    <Modal label="Announcement" returnHref="/announcements">
      <AnnouncementView id={id} permissions={permissions} />
    </Modal>
  );
}
