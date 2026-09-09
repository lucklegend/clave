"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AnnouncementIntent } from "@clavehq/shared";
import { filledButton, textButton } from "@/features/brand/cta";
import { saveAnnouncementAction } from "../actions/save-announcement";
import { AttachmentPicker } from "./AttachmentPicker";

/**
 * The compose form — one form for a new announcement and for editing one that exists, because
 * they differ by a single hidden `id` field and by nothing a person does.
 *
 * `useActionState` over `saveAnnouncementAction`, on `features/auth/components/SignInForm.tsx`'s
 * model: the pending and error states come from React rather than from `useState`, the action
 * redirects on success so there is no success branch to draw, and every field id comes from
 * `useId`.
 *
 * **Why the fields are controlled.** Not for validation — the server owns that — but because a
 * refused submission has to come back with the writing still in it. Attachment rejections are a
 * routine outcome here by design ("Fix or remove them below and submit again"), and React resets
 * an uncontrolled form when a function action settles, which would answer a refused `.docx` by
 * throwing away the notice someone had just written.
 *
 * **Radio rows, not three submit buttons.** The choice is a property of the post rather than of
 * the click that saved it — it has to survive being reopened for editing — and it maps
 * one-to-one onto the `intent` field the action parses.
 */

type EditedAnnouncement = {
  id: string;
  title: string;
  body: string;
  /** Which row the radio group opens on. The edit page derives it from the stored status. */
  intent: AnnouncementIntent;
  /** `announcements.publish_at` as PostgREST answers it, or `null` on a draft. */
  publishAt: string | null;
};

type AnnouncementFormProps = {
  /**
   * The announcement being edited, or `null` to compose a new one. Its presence is what puts an
   * `id` in the form data, which is what makes the action update rather than insert.
   */
  announcement: EditedAnnouncement | null;
  /** The signed-in person's display name, for the line stating who the post will be recorded to. */
  authorName: string | null;
};

// The counters' ceilings. They mirror `announcementDraftSchema`'s `.max()` calls and, through
// them, the `announcements_title_length` / `announcements_body_length` CHECKs — the schema is the
// enforcement and this is the count someone can watch while typing. The shared package exports
// the messages but not the numbers, so they are stated here and named where they came from.
const TITLE_LIMIT = 200;
const BODY_LIMIT = 20_000;

const countFormat = new Intl.NumberFormat("en-PH");

// Philippine time, and not the browser's. `StatusBadge.tsx` already formats every publish time on
// the board in `Asia/Manila` for the reason it records — the audience is a Philippine HOA, not
// the box the server runs on — and a field that took a time in one zone and displayed it back in
// another would be the same bug wearing the author's own clock. It is also what makes the value
// this component renders identical on the server and after hydration: a fixed zone has no
// runtime to disagree about.
const MANILA_TIME_ZONE = "Asia/Manila";

// Two formatters at module scope rather than one per render, on `StatusBadge.tsx`'s note that
// constructing an `Intl.DateTimeFormat` is the expensive part.
const manilaPartsFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const manilaOffsetFormat = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  timeZoneName: "longOffset",
});

// The three rows of "When it goes out", in the design's order. Draft leads, and is also the
// default a new announcement opens on: the first submit of a form nobody has finished should not
// be the one that reaches every resident.
const INTENT_ROWS = [
  {
    value: "draft",
    label: "Save as a draft",
    description:
      "Only you and the village's officers can see it. Nothing goes out, and it has no publish " +
      "time at all.",
  },
  {
    value: "publish",
    label: "Publish now",
    description: "Every resident of the village sees it on their next load.",
  },
  {
    value: "schedule",
    label: "Schedule it",
    description:
      "Residents see it the moment this time passes. Nothing has to be running for that to " +
      "happen.",
  },
] as const satisfies readonly { value: AnnouncementIntent; label: string; description: string }[];

const SUBMIT_LABEL: Record<AnnouncementIntent, { resting: string; pending: string }> = {
  draft: { resting: "Save draft", pending: "Saving…" },
  publish: { resting: "Publish announcement", pending: "Publishing…" },
  schedule: { resting: "Schedule announcement", pending: "Scheduling…" },
};

// M3's outlined text field, transcribed from `SignInForm.tsx` — the 1px `outline` border that
// thickens to 2px `primary` on focus, with the label notched into it — because those class
// strings are local to that component and lifting them out would mean editing the sign-in form,
// which is not this ticket's to touch. Two differences, both forced by where these fields sit:
// the notch is filled with `surface` (the portal's own background, not the sign-in card's
// `surface-container-low`), and no background is baked in, since the scheduled-time field paints
// `surface` over the tinted row it sits in while the other two stay transparent. A `bg-*` here
// could not be overridden from a call site — Tailwind emits the two rules in its own order, not
// the class attribute's.
const fieldBase =
  "w-full rounded-xs border body-l text-on-surface placeholder:text-on-surface-variant " +
  "transition-colors duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] focus:outline-none " +
  "forced-colors:focus:outline group-focus-within:border-2";

function fieldClasses(hasError: boolean) {
  return (
    `${fieldBase} ` +
    (hasError ? "border-error" : "border-outline group-focus-within:border-primary")
  );
}

function labelClasses(hasError: boolean, notchFill: string) {
  return (
    `absolute -top-2 left-3 px-1 body-s ${notchFill} ` +
    (hasError ? "text-error" : "text-on-surface-variant group-focus-within:text-primary")
  );
}

// Supporting text sits at the field's own 16px inset, and carries the counter on its right.
const supportingRowClasses = "mt-1 flex items-start justify-between gap-4 px-4 body-s";

function supportingTextClasses(hasError: boolean) {
  return hasError ? "text-error" : "text-on-surface-variant";
}

// The selected row's fill: the design's `secondary-container` at 34%, composited against
// `surface` so it is opaque and the notch of the field inside it has an exact colour to match.
// **No `m3-state` goes on this row** — `secondary-container` / `on-secondary-container` measures
// 4.54 light and 4.52 dark, and an 8% hover wash spends contrast neither has. The two unselected
// rows keep theirs; the selected row is not an action anyone needs to take twice.
const selectedRowClasses =
  "bg-[color-mix(in_srgb,var(--md-secondary-container)_34%,var(--md-surface))]";

export function AnnouncementForm({ announcement, authorName }: AnnouncementFormProps) {
  const [result, submit] = useActionState(saveAnnouncementAction, null);

  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [intent, setIntent] = useState<AnnouncementIntent>(announcement?.intent ?? "draft");
  const [publishAt, setPublishAt] = useState(toLocalInputValue(announcement?.publishAt ?? null));
  const [files, setFiles] = useState<readonly File[]>([]);

  const titleId = useId();
  const titleHelpId = useId();
  const bodyId = useId();
  const bodyHelpId = useId();
  const publishAtId = useId();
  const publishAtHelpId = useId();

  const titleError = result?.fieldErrors?.title;
  const bodyError = result?.fieldErrors?.body;
  const publishAtError = result?.fieldErrors?.publishAt;

  /**
   * The two values the browser holds that the action cannot read off the form itself.
   *
   * **`publishAt` is the one that matters.** A `datetime-local` input submits `2026-09-10T14:30`
   * with no zone at all, and `announcementDraftSchema` rejects a naive value rather than read it
   * in whatever zone the server happens to run in — a Manila officer's 6am notice would otherwise
   * go out at the container's 6am. So the wall time typed here is stamped with Philippine time's
   * own offset before it is submitted. That is a **convenience over an enforced rule, not the
   * enforcement**: the schema still parses what arrives and still refuses anything without an
   * offset, so tampering with this field buys a field error rather than a mis-scheduled post.
   *
   * The files are appended here for the reason `AttachmentPicker` records: the input they came
   * from is unnamed, and this array is what a removal actually removes from.
   */
  function submitWithClientValues(formData: FormData) {
    if (intent === "schedule") {
      formData.set("publishAt", toOffsetIso(publishAt));
    }

    for (const file of files) {
      formData.append("attachments", file);
    }

    submit(formData);
  }

  return (
    <form action={submitWithClientValues} noValidate>
      {/* Rendered only when there is something to say, as on the sign-in form: a live region
          that is always present is announced as empty on load by some screen readers. When the
          upload pipeline refuses a file this message is "Nothing was saved…", and the per-file
          reasons are drawn on the rows below rather than repeated in here. */}
      {result !== null && (
        <p
          role="alert"
          className="mb-6 rounded-xs bg-error-container px-4 py-3 body-m text-on-error-container"
        >
          {result.message}
        </p>
      )}

      {announcement !== null && <input type="hidden" name="id" value={announcement.id} />}

      <div className="group relative">
        <label className={labelClasses(titleError !== undefined, "bg-surface")} htmlFor={titleId}>
          Title
        </label>
        <input
          id={titleId}
          name="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={TITLE_LIMIT}
          aria-invalid={titleError !== undefined}
          aria-describedby={titleHelpId}
          className={`${fieldClasses(titleError !== undefined)} h-14 bg-transparent px-4`}
        />
        <p className={supportingRowClasses}>
          <span id={titleHelpId} className={supportingTextClasses(titleError !== undefined)}>
            {titleError ?? "Residents see this in the list and in their notification."}
          </span>
          <span className="num shrink-0 text-on-surface-variant">
            {countFormat.format(title.length)} / {countFormat.format(TITLE_LIMIT)}
          </span>
        </p>
      </div>

      <div className="group relative mt-6">
        <label className={labelClasses(bodyError !== undefined, "bg-surface")} htmlFor={bodyId}>
          Description
        </label>
        <textarea
          id={bodyId}
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          maxLength={BODY_LIMIT}
          rows={7}
          aria-invalid={bodyError !== undefined}
          aria-describedby={bodyHelpId}
          className={`${fieldClasses(bodyError !== undefined)} h-42 resize-y bg-transparent p-4`}
        />
        <p className={supportingRowClasses}>
          <span id={bodyHelpId} className={supportingTextClasses(bodyError !== undefined)}>
            {bodyError ?? "The whole notice. Residents read this on the board and in the app."}
          </span>
          <span className="num shrink-0 text-on-surface-variant">
            {countFormat.format(body.length)} / {countFormat.format(BODY_LIMIT)}
          </span>
        </p>
      </div>

      <AttachmentPicker
        files={files}
        errors={result?.attachmentErrors ?? []}
        onAdd={(added) => setFiles((current) => [...current, ...added])}
        onRemove={(index) => setFiles((current) => current.filter((_, at) => at !== index))}
      />

      {/* A fieldset and a legend rather than a heading and a div: the three rows are one control
          answering one question, and that is the grouping a screen reader announces with them.

          `result.fieldErrors.intent` has no renderer here. The radios are the only values this
          form can send and one of them is always selected, so the schema's `intent` issue is not
          a state this UI can reach. */}
      <fieldset className="mt-8">
        <legend className="title-m mb-3 text-on-surface">When it goes out</legend>

        <div className="divide-y divide-outline-variant overflow-hidden rounded-m border border-outline-variant bg-surface">
          {INTENT_ROWS.map((row) => (
            <div key={row.value} className={row.value === intent ? selectedRowClasses : undefined}>
              <label
                className={`flex cursor-pointer items-start gap-4 px-4 py-3.5 ${
                  row.value === intent ? "" : "m3-state"
                }`}
              >
                {/* The native control, themed through `accent-color`, exactly as the sign-in
                    form's "Remember me" checkbox is: an M3 radio drawn as a `<span>` overlay
                    would trade the platform's semantics and keyboard behaviour for a dot. */}
                <input
                  type="radio"
                  name="intent"
                  value={row.value}
                  checked={row.value === intent}
                  onChange={() => setIntent(row.value)}
                  className="mt-1 size-[18px] shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="body-l block text-on-surface">{row.label}</span>
                  <span className="body-m block text-on-surface-variant">{row.description}</span>
                </span>
              </label>

              {row.value === "schedule" && intent === "schedule" && (
                <div className="pr-4 pb-4 pl-13">
                  <div className="group relative max-w-80">
                    <label
                      className={labelClasses(publishAtError !== undefined, selectedRowClasses)}
                      htmlFor={publishAtId}
                    >
                      Publish at
                    </label>
                    <input
                      id={publishAtId}
                      type="datetime-local"
                      value={publishAt}
                      onChange={(event) => setPublishAt(event.target.value)}
                      aria-invalid={publishAtError !== undefined}
                      aria-describedby={publishAtHelpId}
                      className={`${fieldClasses(publishAtError !== undefined)} num h-14 bg-surface px-4`}
                    />
                    <p
                      id={publishAtHelpId}
                      className={`mt-1 px-4 body-s ${supportingTextClasses(publishAtError !== undefined)}`}
                    >
                      {publishAtError ?? "Philippine time — the zone this board publishes in."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {/* Stated where it is decided, and not an editable field. The insert policy pins
          `created_by` to the caller and `announcements_guard_created_by` freezes it afterwards,
          so this line describes the database's behaviour rather than promising it. */}
      <div className="mt-6 flex items-center gap-3 rounded-m bg-surface-container-low px-4 py-3">
        <span
          aria-hidden="true"
          className="label-l inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
        >
          {initialsOf(authorName)}
        </span>
        <p className="body-m text-on-surface-variant">
          Posting as{" "}
          <strong className="font-medium text-on-surface">{authorName ?? "your account"}</strong>.
          The board records this on the announcement and it cannot be changed afterwards.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Link href="/announcements" className={textButton}>
          Cancel
        </Link>
        <SubmitButton intent={intent} />
      </div>
    </form>
  );
}

/**
 * The primary action, labelled by the intent the radios are set to.
 *
 * `useFormStatus` rather than the `isPending` `useActionState` also returns, because this form's
 * `action` is a wrapper that reshapes the `FormData` before dispatching — `useFormStatus` reports
 * the state of the submission this button belongs to, whatever the action does with it, and it is
 * the hook whose whole purpose is a submit button that knows.
 */
function SubmitButton({ intent }: { intent: AnnouncementIntent }) {
  const { pending } = useFormStatus();
  const label = SUBMIT_LABEL[intent];

  return (
    <button type="submit" disabled={pending} className={filledButton}>
      {/* The clock rides on the scheduling button alone, which is the one state the design draws
          it in — the other two intents are unspecified there, and inventing a glyph each is
          invention rather than fidelity. */}
      {intent === "schedule" && <ScheduleGlyph />}
      {pending ? label.pending : label.resting}
    </button>
  );
}

/**
 * `announcements.publish_at` as the value a `datetime-local` input takes: the same instant, in
 * Philippine time, to the minute.
 *
 * Assembled from `formatToParts` rather than from a formatted string, so no locale's separators
 * can change the shape of what an `<input>` will accept.
 */
function toLocalInputValue(publishAt: string | null): string {
  if (publishAt === null) {
    return "";
  }

  const parts = manilaPartsFormat.formatToParts(new Date(publishAt));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/**
 * The wall time the author typed, as an ISO-8601 string carrying an offset — the shape
 * `z.iso.datetime({ offset: true })` accepts and the naive value the input holds is not.
 *
 * A `datetime-local` input's value is either empty or a complete, valid local datetime; there is
 * no half-typed state to defend against here, which is why the only branch is the empty one. The
 * seconds it omits are added because the ISO grammar wants them.
 */
function toOffsetIso(local: string): string {
  if (local === "") {
    return "";
  }

  const withSeconds = local.length === 16 ? `${local}:00` : local;

  return `${withSeconds}${manilaOffset(withSeconds)}`;
}

/**
 * Philippine time's offset from UTC, as `+08:00`.
 *
 * Read from the zone's own data rather than written down as a literal. The instant it is read at
 * is the wall time treated as UTC, which is up to a day out — immaterial in a zone that has held
 * one offset since 1978, and still the right shape if that ever stops being true, where a
 * hardcoded string would silently schedule everything an hour off.
 */
function manilaOffset(wallTime: string): string {
  const parts = manilaOffsetFormat.formatToParts(new Date(`${wallTime}Z`));
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = zone.replace("GMT", "");

  // `longOffset` renders a zero offset as a bare "GMT", which is not an offset a parser accepts.
  return offset === "" ? "+00:00" : offset;
}

/**
 * One or two letters from a display name, transcribed from `AccountButton.tsx` — that copy is a
 * local function in a server component, and one avatar more does not earn a shared module. The
 * `null` case is the same one that component handles: a profile read that answered nothing draws
 * an empty circle rather than a guess.
 */
function initialsOf(name: string | null): string {
  if (name === null) {
    return "";
  }

  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words.at(0)?.at(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.at(0) ?? "") : "";

  return `${first}${last}`.toUpperCase();
}

// The design's own clock, 20px, hand-authored for the reason every other glyph in this feature is
// (`StatusBadge.tsx`): the icon font is subset to the shell's glyphs and a borrowed codepoint
// renders as tofu.
function ScheduleGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.4l2.8 1.8" />
    </svg>
  );
}
