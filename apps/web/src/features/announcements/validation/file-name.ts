/**
 * Filename handling for attachments.
 *
 * Pure string work, no I/O and deliberately no `import "server-only"`: the picker in the browser
 * shows the same name the server will store, and both should get it from here rather than from
 * two implementations that agree until they do not.
 *
 * **The name sanitised here never becomes a path.** A stored object is always
 * `<village_id>/<announcement_id>/<uuid>.<canonical extension>`, where the extension comes from
 * the allowlist in `@clavehq/shared` and the uuid is generated — so nothing an uploader typed
 * reaches Storage. What {@link sanitiseFileName} produces goes into one place only: the
 * `file_name` column, which the board displays and which is handed to `createSignedUrl`'s
 * `download` option so the saved file keeps a name the person recognises. That second use is why
 * this does more than fit the column.
 */

/** Matches the `announcement_attachments_file_name_length` CHECK. */
const MAX_FILE_NAME_LENGTH = 255;

/** What a name that sanitises away to nothing becomes: the column is NOT NULL and 1..255. */
const FALLBACK_FILE_NAME = "attachment";

/**
 * The uploaded name, reduced to something safe to store, display and echo in a header.
 *
 * In order: take the last path segment, so a name carrying directories keeps only the leaf;
 * normalise to NFC, so the same name typed on macOS and on Windows compares equal and occupies
 * the length the database counts; drop control characters and the double quote; collapse runs of
 * whitespace; and cap the length.
 *
 * The control-character strip is the security-bearing line. `file_name` is passed to
 * `createSignedUrl(path, ttl, { download: fileName })`, which puts it inside a quoted
 * `Content-Disposition: attachment; filename="…"` header — a CR or an LF in that value is
 * response-header injection, and a `"` closes the quoting early. Neither can survive this
 * function.
 */
export function sanitiseFileName(fileName: string): string {
  const collapsed = Array.from(lastPathSegment(fileName.normalize("NFC")))
    .filter(isSafeCharacter)
    .join("")
    .replace(/\s+/gu, " ")
    .trim();

  // "." and ".." survive every rule above and are still not names. They are harmless in the
  // column, and they are also the filename a browser would be asked to save the file under.
  if (collapsed === "" || collapsed === "." || collapsed === "..") {
    return FALLBACK_FILE_NAME;
  }

  // Split into code points rather than sliced as a JS string: Postgres `char_length` counts
  // characters, `String.prototype.length` counts UTF-16 units, and one emoji in a filename is
  // enough to turn a 255-unit name into a 255-character CHECK violation.
  const characters = Array.from(collapsed);

  if (characters.length <= MAX_FILE_NAME_LENGTH) {
    return collapsed;
  }

  return characters.slice(0, MAX_FILE_NAME_LENGTH).join("");
}

/**
 * The extension of an uploaded name, lower-cased and without its dot, or `""` if it has none.
 *
 * This is the string `findAttachmentTypeByExtension` in `@clavehq/shared` is asked about, so
 * `""` and anything unrecognised both fail closed at that lookup. A leading dot with nothing
 * before it (`.env`) is a name rather than an extension, and a trailing dot (`report.`) names
 * nothing.
 */
export function fileExtension(fileName: string): string {
  const segment = lastPathSegment(fileName);
  const dot = segment.lastIndexOf(".");

  if (dot <= 0 || dot === segment.length - 1) {
    return "";
  }

  return segment.slice(dot + 1).toLowerCase();
}

/** Everything after the last `/` or `\`, treating both as separators whatever the platform. */
function lastPathSegment(fileName: string): string {
  return fileName.split(/[\\/]/u).at(-1) ?? "";
}

/**
 * Whether one code point may stay in a stored filename.
 *
 * Written as a code-point test rather than as a character class so that the C0 and C1 ranges do
 * not have to appear literally in a regex — which `no-control-regex` would flag, and rightly, as
 * something worth looking at twice.
 */
function isSafeCharacter(character: string): boolean {
  const code = character.codePointAt(0);

  if (code === undefined) {
    return false;
  }

  const isControl = code < 0x20 || (code >= 0x7f && code <= 0x9f);

  return !isControl && character !== '"';
}
