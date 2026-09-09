import { z } from "zod";

/**
 * The compose form's contract: what a person types, and what "when does this go out" means.
 *
 * `villageId` is deliberately **not** a field. The village an announcement belongs to is
 * resolved from the caller's session on the server, never read from the form — a village
 * identifier that arrives in a POST body is a tenancy hole with a friendly name, and the RLS
 * policy would be the only thing standing between it and another village's board.
 *
 * `createdBy` is absent for the same reason, and the database enforces it twice over: the
 * INSERT policy pins `created_by` to `auth.uid()`, and `announcements_guard_created_by` freezes
 * it afterwards.
 */
export const announcementDraftSchema = z
  .object({
    title: z
      .string()
      .trim()
      // 1..200 mirrors the `announcements_title_length` CHECK exactly. The constraint is the
      // enforcement; this is what turns it into a sentence rather than a Postgres error.
      .min(1, "Give the announcement a title.")
      .max(200, "Titles are limited to 200 characters."),
    body: z
      .string()
      .trim()
      // Likewise `announcements_body_length`.
      .min(1, "Write the announcement.")
      .max(20000, "Announcements are limited to 20,000 characters."),
    // Intent, not status. The database's enum has no `scheduled` value — a scheduled post is
    // `published` with a `publish_at` in the future — so "schedule" is a thing the author asks
    // for here, and the writer turns it into a (status, publish_at) pair.
    intent: z.enum(["draft", "publish", "schedule"], {
      error: "Choose whether to save a draft, publish now, or schedule.",
    }),
    publishAt: publishAtField(),
  })
  .superRefine((fields, ctx) => {
    // Only "schedule" carries a time. The other two intents are complete without one, and
    // saying otherwise would put an error on a field the form is not even showing.
    if (fields.intent !== "schedule") {
      return;
    }

    // `instanceof` rather than a comparison against `undefined`, and the difference is not
    // cosmetic: Zod runs an object's refinements even when one of its fields failed to parse,
    // and hands the *raw* input through for the field that did not survive. The declared type
    // here is `Date | undefined`; the runtime value can still be the unparseable string the
    // browser sent, and `.getTime()` on that is a crash inside a server action.
    if (!(fields.publishAt instanceof Date)) {
      ctx.addIssue({ code: "custom", path: ["publishAt"], message: SCHEDULE_NEEDS_A_TIME });
      return;
    }

    // Strictly in the future, with no grace window. A time that has already passed is not a
    // schedule — it is "publish now" spelled slowly, and the SELECT policy would make the post
    // live the instant it was written, which is not what the author asked for. Someone who
    // means now has a button that says so.
    //
    // The clock this reads is the server's, at parse time. A form left open long enough for its
    // chosen time to pass is therefore rejected on submit, which is the honest answer.
    if (fields.publishAt.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["publishAt"], message: SCHEDULE_MUST_BE_FUTURE });
    }
  })
  .transform((fields) => ({
    ...fields,
    // The compose form only *shows* the datetime field for "schedule", and a field that is
    // merely hidden still submits whatever was last typed into it. Dropping the value here
    // means a stale time cannot ride along on a draft — which
    // `announcements_publish_at_iff_published` would reject anyway, as a Postgres error rather
    // than as a message. "Publish now" takes its timestamp from the server clock at write time,
    // not from this field.
    publishAt: fields.intent === "schedule" ? fields.publishAt : undefined,
  }));

export type AnnouncementDraftInput = z.input<typeof announcementDraftSchema>;
export type AnnouncementDraftFields = z.output<typeof announcementDraftSchema>;
export type AnnouncementIntent = AnnouncementDraftFields["intent"];

/**
 * The `publishAt` field, factored out only because the empty-value handling is longer than the
 * rest of the object put together.
 *
 * Absence arrives in three shapes and they all mean the same thing: the key is missing from the
 * FormData (`FormData.get` answers `null`, which is why this is `nullish` rather than
 * `optional`), the key is present but empty because the input was never filled in, or the caller
 * passed `undefined` outright. All three collapse to `undefined` before anything else looks at
 * the value, so the cross-field rule above has one absent case rather than three.
 *
 * **The offset is required, and the compose form has to honour that.** A native `datetime-local`
 * input submits `2026-09-10T14:30` with no timezone, and `new Date` reads such a string in the
 * *runtime's* local zone — the server's, not the author's. An officer in Manila scheduling a 6am
 * notice would get whatever 6am means to the container. The form must convert its local value to
 * an ISO string carrying an offset before it submits; a naive datetime is rejected here rather
 * than silently reinterpreted.
 */
function publishAtField() {
  return z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || undefined)
    .pipe(
      z.iso
        .datetime({ offset: true, error: "Pick a date and time for this announcement." })
        .transform((value) => new Date(value))
        .optional(),
    );
}

/** Shown on the `publishAt` field when "Schedule" is chosen and no time came with it. */
export const SCHEDULE_NEEDS_A_TIME = "Pick when this announcement should go out.";

/** Shown on the `publishAt` field when the chosen time has already passed. */
export const SCHEDULE_MUST_BE_FUTURE =
  "Pick a time in the future, or publish the announcement now.";

/**
 * Shown above the form when the write itself failed — a lost session, a revoked capability, a
 * database that did not answer. Deliberately one message for all of them: the person's next
 * action is the same in every case, and the detail belongs in the server log.
 */
export const ANNOUNCEMENT_SAVE_FAILED_MESSAGE =
  "The announcement could not be saved. Try again, and tell your village administrator if it " +
  "keeps happening.";

/**
 * Shown above the form when the upload pipeline refused one or more files.
 *
 * It has to say that *nothing* was saved, not just that a file was refused. The pipeline is all
 * or nothing and it runs before a single row is written, so someone who reads "that file could
 * not be attached" and closes the tab would otherwise be leaving behind an announcement they
 * believe exists. The per-file reasons ride alongside in `attachmentErrors`.
 */
export const ATTACHMENTS_REFUSED_MESSAGE =
  "Nothing was saved: some of the files could not be attached. Fix or remove them below and " +
  "submit again.";

/**
 * Shown on the edit page when a delete failed — the same single-message reasoning as
 * {@link ANNOUNCEMENT_SAVE_FAILED_MESSAGE}, including for a capability that has been revoked
 * since the page was drawn.
 *
 * The delete control is a plain `<form action>` in a Server Component, so there is no
 * `useActionState` to hand a result back to: the action redirects to the page this message is
 * drawn on rather than returning it.
 */
export const ANNOUNCEMENT_DELETE_FAILED_MESSAGE =
  "The announcement could not be deleted. Try again, and tell your village administrator if it " +
  "keeps happening.";

/**
 * Shown on the edit page when removing one attachment failed, and reached the same way
 * {@link ANNOUNCEMENT_DELETE_FAILED_MESSAGE} is.
 *
 * A separate sentence rather than a shared one, because the two failures leave different states
 * behind: the announcement is still there either way, but only this one leaves a file still
 * attached to it.
 */
export const ATTACHMENT_REMOVE_FAILED_MESSAGE =
  "The file could not be removed. Try again, and tell your village administrator if it keeps " +
  "happening.";

/**
 * One file the upload pipeline refused, in the form the compose form shows it.
 *
 * Its own carrier rather than another key in `fieldErrors`, because an attachment rejection is
 * not about a field: `fieldErrors` is keyed by `keyof AnnouncementDraftFields`, and "this .docx
 * contains macros" belongs to none of the four. The two also arrive at different moments — a
 * field error comes from `announcementDraftSchema` before anything else runs, an attachment
 * error comes from the server pipeline that only runs once the fields have passed.
 *
 * `message` is ready to show and is already prefixed with the filename where there is one.
 * `fileName` is carried separately so the picker can mark the row it belongs to, and is `null`
 * for the rules that are about the set rather than any one member of it — a sixth file, and a
 * total over the cap, are nobody's file in particular.
 */
export type AttachmentError = {
  fileName: string | null;
  message: string;
};

/**
 * What the save action hands back to the form.
 *
 * The same discriminated-union shape as `SignInFailure` in `./auth`, and for the same reason:
 * with no success variant, a caller that forgets to check `ok` cannot read `fieldErrors` off a
 * success. On success the action redirects and never returns.
 */
export type SaveAnnouncementFailure = {
  ok: false;
  /** Shown once, above the form, in a `role="alert"` region. */
  message: string;
  /** Populated by schema validation only, keyed by the field the issue's path names. */
  fieldErrors?: Partial<Record<keyof AnnouncementDraftFields, string>>;
  /**
   * Populated by the upload pipeline only. Present means the announcement was **not** written:
   * the pipeline runs before the insert, and it refuses a set of files entire.
   */
  attachmentErrors?: readonly AttachmentError[];
};

export type SaveAnnouncementResult = SaveAnnouncementFailure;

// There is no `DeleteAnnouncementResult` beside the two above. The delete and the
// remove-attachment actions are dispatched from plain `<form action>` elements in Server
// Components, which have nowhere to put a returned value: both redirect on every path and say
// what went wrong with the two message constants above.

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** Only for turning byte counts into the numbers the messages below quote. */
const BYTES_PER_MEGABYTE = 1_048_576;

/**
 * The caps, applied in three places that have to agree: the picker's convenience pre-check in
 * the browser, the server pipeline that actually enforces them, and — for the per-file cap — the
 * bucket's own `file_size_limit`, which is what holds if a future caller forgets the other two.
 *
 * `maxBytesPerFile` is written as the literal 10485760 rather than as `10 * 1024 * 1024` so that
 * it greps against the `file_size_limit` in
 * `supabase/migrations/20260909120000_announcements.sql`. Change one and you must change both.
 */
export const ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxBytesPerFile: 10_485_760,
  maxBytesTotal: 26_214_400,
} as const;

export const TOO_MANY_ATTACHMENTS_MESSAGE = `Attach at most ${ATTACHMENT_LIMITS.maxFiles} files.`;

export const ATTACHMENT_TOO_LARGE_MESSAGE = `Each file must be ${
  ATTACHMENT_LIMITS.maxBytesPerFile / BYTES_PER_MEGABYTE
} MB or smaller.`;

export const ATTACHMENTS_TOO_LARGE_MESSAGE = `All the files together must be ${
  ATTACHMENT_LIMITS.maxBytesTotal / BYTES_PER_MEGABYTE
} MB or smaller.`;

/**
 * Every file type the board accepts, and the bytes each one has to start with.
 *
 * One table, because four questions are asked of a single upload and every one of them has to
 * reach the same answer: does the extension name a type we take, does the browser's claimed MIME
 * agree, do the leading bytes agree, and what content type do we hand Storage when we write the
 * object. Splitting that across four lists is how an allowlist grows a hole.
 *
 * `mimeType` is the **canonical** type. It is what the upload declares as `contentType`, never
 * the browser's `File.type`, which the operating system derives from the extension and which is
 * trivially wrong or absent.
 *
 * `extension` is likewise canonical, and it is the only one that ever appears in a stored object
 * name: objects are `<village_id>/<announcement_id>/<uuid>.<extension>`, so nothing an uploader
 * typed reaches a path. `alternateExtensions` are the other spellings a person may legitimately
 * upload that mean the same format.
 *
 * `magic` is data rather than code so that this file stays the one place a type is described.
 * `apps/web/src/features/announcements/validation/magic-bytes.ts` switches on `magic.kind` and
 * holds no byte literals of its own.
 *
 * **What is deliberately missing, and must stay missing:**
 *
 *   * **SVG.** It is an image by extension and a script host in fact — `<script>`, `onload=` and
 *     `<foreignObject>` all run when the file is rendered in a document. Uploading one to a
 *     board that other residents open is the textbook stored-XSS delivery, and no amount of
 *     sniffing helps, because a malicious SVG is a perfectly valid SVG.
 *
 *   * **`.doc`, `.xls`, `.ppt`** — the pre-2007 OLE compound formats. They are macro-bearing by
 *     construction, and unlike their OOXML successors they cannot be inspected the way
 *     `office-zip.ts` inspects a ZIP: there are no named parts to read, only a binary
 *     structured-storage container that would need a parser of its own to say anything at all
 *     about what is inside. An allowlist entry we cannot check is not an allowlist entry.
 */
export const ATTACHMENT_TYPES = [
  {
    format: "pdf",
    extension: "pdf",
    alternateExtensions: [],
    mimeType: "application/pdf",
    // "%PDF-".
    magic: { kind: "prefix", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  },
  {
    format: "docx",
    extension: "docx",
    alternateExtensions: [],
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // "PK\x03\x04" — a ZIP local file header. All three OOXML formats share it, so the magic
    // bytes prove only that the file is an archive. Which archive it is, and whether it carries
    // macros, is `office-zip.ts`'s question.
    magic: { kind: "prefix", bytes: [0x50, 0x4b, 0x03, 0x04] },
  },
  {
    format: "xlsx",
    extension: "xlsx",
    alternateExtensions: [],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    magic: { kind: "prefix", bytes: [0x50, 0x4b, 0x03, 0x04] },
  },
  {
    format: "pptx",
    extension: "pptx",
    alternateExtensions: [],
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    magic: { kind: "prefix", bytes: [0x50, 0x4b, 0x03, 0x04] },
  },
  {
    format: "jpeg",
    // ".jpg" is the canonical spelling here because it is the one every operating system shows
    // and every camera writes; ".jpeg" is accepted and normalised to it.
    extension: "jpg",
    alternateExtensions: ["jpeg"],
    mimeType: "image/jpeg",
    // FF D8 FF. The fourth byte varies by segment marker (E0 for JFIF, E1 for Exif, DB for a
    // bare quantisation table), so three bytes is the whole of the reliable signature.
    magic: { kind: "prefix", bytes: [0xff, 0xd8, 0xff] },
  },
  {
    format: "png",
    extension: "png",
    alternateExtensions: [],
    mimeType: "image/png",
    // The full eight-byte PNG signature, including the CRLF/EOF pair that exists precisely to
    // catch a file mangled by a text-mode transfer.
    magic: { kind: "prefix", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  },
  {
    format: "heic",
    extension: "heic",
    alternateExtensions: [],
    mimeType: "image/heic",
    // HEIC is ISO base media format: the first box is `ftyp`, whose type sits at offset 4 and
    // whose major brand follows at offset 8. The brand is what separates a HEIF still from an
    // MP4 — both are ISO-BMFF and both start the same way — so the brand set is the signature.
    magic: {
      kind: "isoBaseMedia",
      brands: ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"],
    },
  },
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];
export type AttachmentFormat = AttachmentType["format"];

/**
 * The allowed type an extension names, or `undefined`.
 *
 * Case-insensitive, and it takes the extension without its dot. Both spellings of JPEG resolve to
 * the same entry, whose canonical `extension` is the one every caller should use from then on.
 */
export function findAttachmentTypeByExtension(extension: string): AttachmentType | undefined {
  const normalised = extension.toLowerCase();

  return ATTACHMENT_TYPES.find((type) => {
    // Widened on the way in, because `as const` types the empty lists as `readonly []`, and
    // `includes` on that accepts nothing but `never`.
    const alternates: readonly string[] = type.alternateExtensions;

    return type.extension === normalised || alternates.includes(normalised);
  });
}

/**
 * The allowed type a stored MIME type names, or `undefined`.
 *
 * The counterpart to {@link findAttachmentTypeByExtension}, and it asks about a different string:
 * an extension is what an *uploader* typed, while a MIME type here is what the pipeline already
 * decided and wrote to `announcement_attachments.mime_type` — always the canonical `mimeType` of
 * an entry above, never the browser's `File.type`. So a stored row always resolves, and anything
 * that does not resolve is a row this build does not recognise, which is the fail-closed answer
 * every caller wants.
 *
 * Trimmed and lower-cased because MIME types are case-insensitive by definition; parameters
 * (`image/jpeg; charset=binary`) are deliberately *not* stripped, since no such value is ever
 * written and inventing tolerance for one would widen what {@link isImageFormat} then vouches for.
 */
export function findAttachmentTypeByMimeType(mimeType: string): AttachmentType | undefined {
  const normalised = mimeType.trim().toLowerCase();

  return ATTACHMENT_TYPES.find((type) => type.mimeType === normalised);
}

/**
 * The formats that are images *as stored*, which is a smaller set than the formats that are
 * images.
 *
 * `heic` is absent on purpose and its absence is load-bearing. HEIC is an upload format only:
 * `apps/web/src/features/announcements/server/transcode.ts` decodes one and re-encodes it as
 * JPEG, so `image/heic` never reaches the `mime_type` column, and no browser renders it anyway.
 * A guard that admitted it would vouch for a format nothing can display and nothing can produce.
 */
export type ImageAttachmentFormat = Extract<AttachmentFormat, "jpeg" | "png">;

/**
 * Whether an attachment is an image — the one place that question is answered.
 *
 * Two callers, and they must never disagree. The announcement view uses it to decide whether a
 * file is drawn as a preview or listed as a document, and
 * `app/(portal)/announcements/[id]/files/[attachmentId]/route.ts` uses it to decide whether a
 * stored object may be signed for **inline** delivery. That second use is the whole of the
 * amendment to `docs/decisions/0004-announcements-and-attachment-uploads.md` D6, which otherwise
 * says no attachment is ever served inline: the exposure is narrowed to exactly the two raster
 * formats this returns `true` for, and it is narrowed here rather than at the route so that a
 * component and a security guard cannot drift into two different ideas of "image".
 *
 * `isTranscodableFormat` in `server/transcode.ts` looks like this function and is not it: that
 * one is about which formats the *upload* pipeline re-encodes (it includes `heic`), and it lives
 * in a module that imports `sharp`, so nothing rendered in a browser can call it. This one is
 * pure, does no I/O, and imports nothing.
 */
export function isImageFormat(format: AttachmentFormat): format is ImageAttachmentFormat {
  return format === "jpeg" || format === "png";
}
