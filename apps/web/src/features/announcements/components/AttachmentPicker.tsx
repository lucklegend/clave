"use client";

import { useId, type ChangeEvent, type DragEvent } from "react";
import {
  ATTACHMENTS_TOO_LARGE_MESSAGE,
  ATTACHMENT_LIMITS,
  ATTACHMENT_TOO_LARGE_MESSAGE,
  ATTACHMENT_TYPES,
  TOO_MANY_ATTACHMENTS_MESSAGE,
  findAttachmentTypeByExtension,
  type AttachmentError,
  type AttachmentFormat,
} from "@clavehq/shared";
import { formatBytes } from "../format-bytes";
import { fileExtension, sanitiseFileName } from "../validation/file-name";

/**
 * The compose form's attachment section: the dropzone, the chosen files, and — the state this
 * whole feature is really about — the ones the server refused.
 *
 * **It holds no state.** `AnnouncementForm` owns the file list, because that list is what the
 * submit handler appends to the `FormData` under the repeated `attachments` name; a picker
 * keeping its own copy would be a second source of truth for the thing being uploaded. This
 * component draws that list and reports what the person did to it.
 *
 * The file input is deliberately **unnamed**, so the browser never submits it. `<input
 * type="file">` cannot be controlled from React and its `FileList` is read-only, so removing the
 * third of five files by rewriting the input would mean building a `DataTransfer` to assign back
 * to `input.files`. Appending the array at submit time instead keeps a removal a plain `filter`
 * and leaves nothing on the input to go stale.
 *
 * **The two checks it makes are convenience, not enforcement**, and both are made with the
 * constants and the message strings `@clavehq/shared` exports precisely so the browser and
 * `server/attachments.ts` cannot answer differently — `ATTACHMENT_LIMITS`'s own doc comment names
 * this picker as one of the three places those caps apply. Everything the caps cannot see (the
 * real type in the leading bytes, macros in an Office archive, a scanner verdict) is the server's
 * answer alone and arrives here as {@link AttachmentError}s.
 */

type AttachmentPickerProps = {
  /** The files chosen so far, in the order they will be uploaded. */
  files: readonly File[];
  /**
   * What the last submission refused, straight from `SaveAnnouncementFailure.attachmentErrors`.
   * Each `message` is ready to show and already names its file; `fileName` is what pairs it with
   * a row below, and is `null` for the rules that are about the set rather than one member of it.
   */
  errors: readonly AttachmentError[];
  onAdd: (added: readonly File[]) => void;
  onRemove: (index: number) => void;
};

// The dropzone states its own limits rather than waiting for a rejection to explain them — the
// design's line, with both numbers read from the shared caps so the sentence cannot drift from
// what the server enforces.
const BYTES_PER_MEGABYTE = 1_048_576;

const LIMITS_LINE =
  `PDF, Word, Excel, PowerPoint, JPEG, PNG or HEIC · ` +
  `${ATTACHMENT_LIMITS.maxBytesPerFile / BYTES_PER_MEGABYTE} MB each · ` +
  `${ATTACHMENT_LIMITS.maxFiles} files`;

// The file dialog's own filter, built from the allowlist rather than typed out beside it. Both
// halves are worth sending: a browser matches extensions on Windows and Linux and UTIs derived
// from the MIME types on macOS. It is not a check — `accept` is a filter a person can defeat with
// the "All files" option in the same dialog.
const ACCEPT = ATTACHMENT_TYPES.flatMap((type) => [
  `.${type.extension}`,
  ...type.alternateExtensions.map((alternate) => `.${alternate}`),
  type.mimeType,
]).join(",");

// The type badge's fill. Three tones come from the design — PDF on `error-container`, XLSX on
// `secondary-container`, JPG on `tertiary-container` — and the other four are assigned by family:
// the two remaining Office formats take a container tone each, and the images share JPEG's, since
// what the badge distinguishes is the kind of file rather than the codec.
const FORMAT_TONE: Record<AttachmentFormat, string> = {
  pdf: "bg-error-container text-on-error-container",
  docx: "bg-primary-container text-on-primary-container",
  xlsx: "bg-secondary-container text-on-secondary-container",
  pptx: "bg-surface-container-highest text-on-surface-variant",
  jpeg: "bg-tertiary-container text-on-tertiary-container",
  png: "bg-tertiary-container text-on-tertiary-container",
  heic: "bg-tertiary-container text-on-tertiary-container",
};

// A file whose extension matches no allowlist entry. It is drawn rather than refused here: the
// bytes are what decide, and they are read on the server.
const UNKNOWN_TONE = "bg-surface-container-highest text-on-surface-variant";

// `outline` and not `outline-variant`: this is the boundary of a control a file is dropped onto,
// not a divider (D4 rule 1). Dashed is what says "target" where a solid border would not.
const dropzoneClasses =
  "flex cursor-pointer flex-col items-center gap-0.5 rounded-m border border-dashed " +
  "border-outline bg-surface-container-low px-6 py-7 text-center " +
  "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-primary " +
  "has-[input:focus-visible]:outline-offset-2";

const rowClasses = "flex items-center gap-3 py-3 pr-3 pl-4";

// The refused row's fill: the design's `error-container` at 45%, composited against `surface`
// rather than against `transparent` so the row is opaque and lands on the tone the design
// measured. `on-error-container` on it clears AA in both schemes.
const refusedRowClasses = "bg-[color-mix(in_srgb,var(--md-error-container)_45%,var(--md-surface))]";

const badgeClasses = "label-s inline-flex size-10 shrink-0 items-center justify-center rounded-s";

const removeButtonClasses =
  "m3-state inline-flex size-10 shrink-0 items-center justify-center rounded-full";

export function AttachmentPicker({ files, errors, onAdd, onRemove }: AttachmentPickerProps) {
  const inputId = useId();

  const rows = files.map((file, index) => {
    // The name the server will store, produced by the function that will store it — the point
    // `validation/file-name.ts` makes about the picker and the pipeline sharing one
    // implementation. It is also what pairs a rejection with its row, since a rejection names the
    // sanitised name rather than the one the operating system handed the browser.
    const name = sanitiseFileName(file.name);
    const type = findAttachmentTypeByExtension(fileExtension(file.name));
    const refusal = errors.find((error) => error.fileName === name);

    // The server's own wording wins wherever it has spoken, minus the filename it prefixes every
    // rejection with — the row is already showing that name on the line above, and the design
    // draws the reason under it rather than the sentence twice.
    const refused = refusal === undefined ? null : withoutFileNamePrefix(refusal.message, name);
    const tooLarge = file.size > ATTACHMENT_LIMITS.maxBytesPerFile;

    return {
      // Two files with the same name is something a person can genuinely choose, so the index is
      // part of the key.
      key: `${index}-${name}`,
      name,
      badge: type === undefined ? "FILE" : type.extension.toUpperCase(),
      tone: type === undefined ? UNKNOWN_TONE : FORMAT_TONE[type.format],
      size: formatBytes(file.size),
      error: refused ?? (tooLarge ? ATTACHMENT_TOO_LARGE_MESSAGE : null),
      onRemove: () => onRemove(index),
    };
  });

  const rowNames = new Set(rows.map((row) => row.name));

  // Everything that belongs to no row: the set-level rules — a sixth file, a total over the cap —
  // and any rejection whose file has since been removed from the list. Both still have to be
  // read, so they are drawn as rows of their own rather than dropped for having nowhere to sit.
  const setMessages = [
    ...(files.length > ATTACHMENT_LIMITS.maxFiles ? [TOO_MANY_ATTACHMENTS_MESSAGE] : []),
    ...(totalBytes(files) > ATTACHMENT_LIMITS.maxBytesTotal ? [ATTACHMENTS_TOO_LARGE_MESSAGE] : []),
    ...errors
      .filter((error) => error.fileName === null || !rowNames.has(error.fileName))
      .map((error) => error.message),
  ];

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files;

    if (chosen !== null) {
      onAdd(Array.from(chosen));
    }

    // Cleared so that choosing the same file again — after removing it, say — still fires
    // `change`. Nothing is lost by it: this input is not what gets submitted.
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    onAdd(Array.from(event.dataTransfer.files));
  }

  return (
    <section className="mt-8">
      <h3 className="title-m mb-3 text-on-surface">Attachments</h3>

      {/* The input sits inside the label with no `htmlFor` pointing back at it: the implicit
          association is what makes the whole zone clickable, and carrying the explicit one as
          well makes some browsers open the dialog twice. `preventDefault` on dragover is what
          makes the element a drop target at all. */}
      <label
        className={dropzoneClasses}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <span className="mb-1.5 inline-flex size-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <UploadGlyph />
        </span>
        <span className="body-l text-on-surface">
          Drop files here, or <span className="text-primary underline">browse</span>
        </span>
        <span className="body-s text-on-surface-variant">{LIMITS_LINE}</span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleChange}
          className="sr-only"
        />
      </label>

      {(rows.length > 0 || setMessages.length > 0) && (
        <div className="mt-3 divide-y divide-outline-variant overflow-hidden rounded-m border border-outline-variant bg-surface">
          {rows.map((row) => (
            <div
              key={row.key}
              className={`${rowClasses} ${row.error === null ? "" : refusedRowClasses}`}
            >
              {row.error === null ? (
                <span className={`${badgeClasses} ${row.tone}`}>{row.badge}</span>
              ) : (
                <span className={`${badgeClasses} bg-error text-on-error`}>
                  <AlertGlyph />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="body-m block truncate text-on-surface">{row.name}</span>
                {row.error === null ? (
                  <span className="body-s num block text-on-surface-variant">{row.size}</span>
                ) : (
                  <span className="body-s block text-on-error-container">{row.error}</span>
                )}
              </span>
              <button
                type="button"
                onClick={row.onRemove}
                aria-label={`Remove ${row.name}`}
                className={`${removeButtonClasses} ${
                  row.error === null ? "text-on-surface-variant" : "text-on-error-container"
                }`}
              >
                <RemoveGlyph />
              </button>
            </div>
          ))}

          {/* No remove control on these: a cap on the set and a rejection whose file is already
              gone are both about the list as a whole, and there is nothing here to take away. */}
          {setMessages.map((message) => (
            <div key={message} className={`${rowClasses} ${refusedRowClasses}`}>
              <span className={`${badgeClasses} bg-error text-on-error`}>
                <AlertGlyph />
              </span>
              <span className="body-s min-w-0 flex-1 text-on-error-container">{message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * A rejection with the filename `fileRejection` prefixes it with taken back off, so the row can
 * show the name once. Only an exact `"<name> — "` is dropped: a message that names the file some
 * other way, or names a different one, is left exactly as the server wrote it.
 */
function withoutFileNamePrefix(message: string, fileName: string): string {
  const prefix = `${fileName} — `;

  return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

function totalBytes(files: readonly File[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

// The three glyphs this section draws, transcribed from `AnnouncementCompose.dc.html` on the
// precedent `StatusBadge.tsx` sets: the icon font is subset to the shell's own glyphs, so a
// codepoint borrowed here would render as tofu. Every one is `aria-hidden` — the upload arrow
// sits beside the words that name it, the cross is inside a button carrying an `aria-label`, and
// the alert circle repeats what the message beside it already says.

function UploadGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 16.5V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15" />
    </svg>
  );
}

function RemoveGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 7v6M12 16.4v.2" />
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}
