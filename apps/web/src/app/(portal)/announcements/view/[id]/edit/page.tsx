import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  ANNOUNCEMENT_DELETE_FAILED_MESSAGE,
  ATTACHMENT_REMOVE_FAILED_MESSAGE,
  type AnnouncementIntent,
} from "@clavehq/shared";
import { AnnouncementForm } from "@/features/announcements/components/AnnouncementForm";
import { AttachmentGuidance } from "@/features/announcements/components/AttachmentGuidance";
import { AttachmentList } from "@/features/announcements/components/AttachmentList";
import { DeleteAnnouncement } from "@/features/announcements/components/DeleteAnnouncement";
import { parseEditFailure, type EditFailure } from "@/features/announcements/edit-url";
import { fetchAnnouncementById } from "@/features/announcements/server/queries";
import { createAttachmentDownloadUrl } from "@/features/announcements/server/storage";
import { announcementDisplayStatus } from "@/features/announcements/status";
import type { AnnouncementRecord } from "@/features/announcements/types";
import { createSupabaseServerClient } from "@/features/auth/lib/server";
import { can } from "@/features/authz/permissions";
import { loadAuthzContext } from "@/features/authz/server/context";
import { loadAccountName } from "@/features/portal/server/identity";

export const metadata: Metadata = {
  title: "Edit announcement — claveHQ",
  robots: { index: false, follow: false },
};

/**
 * The same compose form, loaded with an announcement that exists. Every row on the board links
 * here.
 *
 * **Three different absences, three different answers.** A caller without the capability, an id
 * that is not a uuid and an id RLS will not show this caller all get `notFound()` — a 404 that
 * says nothing about which of the three it was, and in particular nothing about whether an
 * announcement with that id exists in some other village. A *failed read* is not one of them:
 * `fetchAnnouncementById` answers `null` for a database that did not respond and `{ row: null }`
 * for a row nobody can see, and an outage rendered as "no such announcement" is the quietest kind
 * of wrong.
 *
 * **This page is where an attachment is retrieved and where a post is destroyed.** Both controls
 * live below the form rather than inside it, because HTML has no nested forms and both are their
 * own `<form action>`: the compose form saves, and these two do something a save cannot express.
 * The download URLs are minted here, at render, for exactly the rows being drawn — see
 * `createAttachmentDownloadUrl` for why a signed URL is never stored or shared between renders.
 */
export default async function EditAnnouncementPage({
  params,
  searchParams,
}: PageProps<"/announcements/view/[id]/edit">) {
  const result = await loadAuthzContext();

  if (result.status === "signed-out") {
    redirect("/sign-in");
  }

  if (result.status !== "ok") {
    return null;
  }

  const { permissions, userId, village } = result.context;

  if (!can(permissions, "announcements.create")) {
    notFound();
  }

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const identifier = z.uuid().safeParse(id);

  // Parsed before it reaches PostgREST, which answers a malformed uuid with an error — and an
  // error is how this file says "the database is down". A junk id is a stale link, not an outage.
  if (!identifier.success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const [found, authorName] = await Promise.all([
    fetchAnnouncementById(supabase, identifier.data),
    loadAccountName(userId),
  ]);

  if (found === null) {
    return (
      <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
        <h2 className="headline-m text-on-surface">Edit announcement</h2>
        <p className="body-l mt-3 max-w-[62ch] text-on-surface-variant">
          The announcement could not be loaded. Reload the page; if it keeps happening, the database
          is the place to look.
        </p>
      </main>
    );
  }

  if (found.row === null) {
    notFound();
  }

  const announcement = found.row;

  // One signed URL per attachment, minted for this render and this caller. `Promise.all` because
  // they are independent round trips to Storage and a page with five files should not wait for
  // five of them in a row.
  const attachments = await Promise.all(
    announcement.attachments.map(async (attachment) => ({
      ...attachment,
      downloadUrl: await createAttachmentDownloadUrl(
        supabase,
        attachment.storage_path,
        attachment.file_name,
      ),
    })),
  );

  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      {/* The compose page's own two columns; see `new/page.tsx` for the arithmetic behind 1440. */}
      <div className="flex flex-col gap-6 min-[1440px]:flex-row min-[1440px]:items-start">
        <div className="min-w-0 min-[1440px]:w-[680px] min-[1440px]:flex-none">
          <h2 className="headline-m text-on-surface">Edit announcement</h2>
          <p className="body-l mt-2 mb-6 text-on-surface-variant">
            Posted to <strong className="font-medium text-on-surface">{village.name}</strong>.
            Changing when it goes out changes what residents can already see.
          </p>

          {/* A `<form action>` reports a refusal by redirecting back here with a flag, because a
              Server Component has nowhere to receive a returned result — see
              `features/announcements/edit-url.ts`. */}
          <FailureNotice failure={parseEditFailure(query.failed)} />

          {/* Above the form, and that position is the whole of ticket 0011's step 6.
              Underneath it, the first thing an editor saw was the dropzone — which starts
              empty, because it holds files being *added* — with the files already on the post
              drawn below the submit button. Editing a post with three attachments therefore
              opened on an empty dropzone, which reads as "my files are gone, and saving will
              finish the job". Nothing was ever lost: `saveAnnouncementAction` appends and has
              never deleted an existing row. But a layout that makes a correct system look
              broken costs the same as a broken one until someone checks.

              Drawn only when there is something to draw: a post with no files needs no list
              saying so. */}
          {attachments.length > 0 && (
            <AttachmentList
              announcementId={announcement.id}
              attachments={attachments}
              canRemove={can(permissions, "announcements.update")}
            />
          )}

          <AnnouncementForm
            announcement={{
              id: announcement.id,
              title: announcement.title,
              body: announcement.body,
              intent: openingIntent(announcement),
              publishAt: announcement.publish_at,
            }}
            authorName={authorName}
          />

          {can(permissions, "announcements.delete") && (
            <DeleteAnnouncement announcementId={announcement.id} />
          )}
        </div>

        <div className="min-[1440px]:w-80 min-[1440px]:flex-none">
          <AttachmentGuidance />
        </div>
      </div>
    </main>
  );
}

/**
 * What the last delete or removal refused, said once, above the form.
 *
 * The wording comes from `@clavehq/shared` and the URL only names which of the two happened: a
 * page that rendered a message out of its own query string would take dictation from whoever
 * wrote the link.
 */
function FailureNotice({ failure }: { failure: EditFailure | null }) {
  if (failure === null) {
    return null;
  }

  return (
    <p
      role="alert"
      className="mb-6 rounded-xs bg-error-container px-4 py-3 body-m text-on-error-container"
    >
      {failure === "delete" ? ANNOUNCEMENT_DELETE_FAILED_MESSAGE : ATTACHMENT_REMOVE_FAILED_MESSAGE}
    </p>
  );
}

/**
 * The radio the form opens on, from the row as it is stored.
 *
 * `announcementDisplayStatus` is the one place that turns (status, publish_at) into what a person
 * is shown, so the intent is derived from its answer rather than from a second reading of the
 * same two columns. Only the name differs: what the board calls "scheduled" is what this form
 * calls "schedule".
 *
 * `now` is read here rather than passed in because this page renders once and nothing else on it
 * depends on the same instant — unlike the board, which draws a list and a set of counts that
 * would disagree if they were answered from two different clocks.
 *
 * The archived arm exists because the display status has four values and the form offers three.
 * Nothing in the portal can archive a post today — the enum value has no writer — so it is
 * unreachable rather than a case with an opinion behind it; a draft is the intent that changes
 * least if it ever becomes reachable.
 */
function openingIntent(announcement: AnnouncementRecord): AnnouncementIntent {
  const status = announcementDisplayStatus(announcement, new Date());

  if (status === "scheduled") {
    return "schedule";
  }

  return status === "published" ? "publish" : "draft";
}
