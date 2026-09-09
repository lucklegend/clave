import { unzipSync, type UnzipFileInfo } from "fflate";
import type { AttachmentFormat } from "@clavehq/shared";

/**
 * Deep inspection of the three Office formats the board accepts.
 *
 * A `.docx`, `.xlsx` or `.pptx` is a ZIP archive of XML parts, which is what makes them the only
 * document types here that can be examined at all — and also what makes their magic bytes
 * worthless on their own: `./magic-bytes` can prove a file is *an* archive, never which one. The
 * questions left over are the ones that decide whether a macro-bearing spreadsheet reaches a
 * village's board, and they are all answered from the archive's own table of contents.
 *
 * Pure and injectable like the rest of `validation/`: a `Uint8Array` in, a verdict out, no I/O
 * and no `import "server-only"`. `fflate` is the one dependency, chosen because it is a few
 * kilobytes with no dependencies of its own — an upload-inspection path is a bad place to take on
 * a transitive tree.
 *
 * **Nothing here decompresses the document.** Two passes over the archive: the first reads the
 * central directory through `unzipSync`'s `filter` hook and returns `false` for every entry, so
 * fflate lists the parts without inflating any of them; the second inflates exactly one part,
 * `[Content_Types].xml`, and only after its declared size has been checked. A zip bomb is
 * therefore rejected from its own headers rather than after it has been unpacked into memory.
 */
export type OfficeArchiveInspection =
  { ok: true } | { ok: false; reason: OfficeArchiveRejectionReason; message: string };

export type OfficeArchiveRejectionReason =
  "unreadable" | "unsafe-entry-name" | "macros" | "archive-bomb" | "format-mismatch";

/**
 * Derived from the allowlist rather than written out, so that renaming a format in
 * `ATTACHMENT_TYPES` fails this build instead of quietly leaving an uninspected type behind.
 */
export type OfficeOpenXmlFormat = Extract<AttachmentFormat, "docx" | "xlsx" | "pptx">;

/** The part every OOXML package must carry: the map from part name to content type. */
const CONTENT_TYPES_PART = "[Content_Types].xml";

/** Lower-cased, because the check compares the entry's last path segment case-insensitively. */
const MACRO_PART_NAMES = ["vbaproject.bin", "vbadata.xml"];

/**
 * A content type naming a macro-enabled format (`…macroEnabled.main+xml`) or the VBA project
 * part. This is what catches a `.docm` renamed to `.docx`: the extension changed, the package's
 * declaration of what it is did not.
 *
 * A substring match over the raw XML rather than a parse. There is no XML parser in this repo and
 * this does not justify adding one — the failure mode of matching too much is refusing a document
 * whose part *names* contain the word, which is a false rejection of something no one uploads,
 * and the failure mode of parsing badly is accepting macros.
 */
const MACRO_CONTENT_TYPE_PATTERN = /macroenabled|vbaproject/iu;

/**
 * Two thousand parts. A Word document runs to tens, and a large spreadsheet with images and
 * several sheets to a few hundred; nothing legitimate approaches this. The cap exists because
 * every entry costs a pass through the checks below, and an archive can declare millions.
 */
const MAX_ENTRIES = 2_000;

/**
 * 64 MiB of declared uncompressed content, against a per-file upload cap of 10 MiB.
 *
 * The two caps together are the zip-bomb rule. A real document expands by roughly 2–8×, because
 * the bulk of it is images that are already compressed; the XML parts inflate further but are
 * small. Anything claiming to unpack to more than six times the largest file we accept is not a
 * document, and the classic bombs claim thousands of times that.
 */
const MAX_DECLARED_BYTES = 67_108_864;

/**
 * 200:1 across the whole archive, checked alongside the absolute cap so that a *small* archive
 * cannot slip a large expansion past it. Text-only OOXML packages are the high end of legitimate
 * and land around 20:1; a deflate stream's theoretical ceiling is 1032:1, which is the number the
 * bombs are built against.
 */
const MAX_EXPANSION_RATIO = 200;

/** `[Content_Types].xml` is a few kilobytes in every real package. One MiB is already absurd. */
const MAX_CONTENT_TYPES_BYTES = 1_048_576;

/**
 * What each format's package must declare, and where its parts must live.
 *
 * The main-part content type is the load-bearing half: it is unique per format and it is what a
 * macro-enabled or mislabelled package gets wrong. The directory prefix is a second, cruder
 * check on the parts themselves, so that a package whose `[Content_Types].xml` says one thing
 * while its contents say another is refused too.
 */
const FORMAT_EXPECTATIONS = {
  docx: {
    partPrefix: "word/",
    mainPartContentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  },
  xlsx: {
    partPrefix: "xl/",
    mainPartContentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  },
  pptx: {
    partPrefix: "ppt/",
    mainPartContentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  },
} as const satisfies Record<
  OfficeOpenXmlFormat,
  { partPrefix: string; mainPartContentType: string }
>;

/**
 * Whether an Office archive may be stored, or why it may not.
 *
 * `format` is what the extension and the magic bytes already agreed on — this function does not
 * guess, it verifies that the package agrees with them too.
 */
export function inspectOfficeArchive(
  archive: Uint8Array,
  format: OfficeOpenXmlFormat,
): OfficeArchiveInspection {
  const entries = listEntries(archive);

  // An archive that lists nothing is not rejected here: it is a readable ZIP that simply has no
  // content-type map, and the check further down names that for what it is.
  if (entries === null) {
    return {
      ok: false,
      reason: "unreadable",
      message: `This file could not be opened as a .${format} document.`,
    };
  }

  if (entries.length > MAX_ENTRIES) {
    return { ok: false, reason: "archive-bomb", message: EXPANDS_TOO_FAR_MESSAGE };
  }

  for (const entry of entries) {
    if (escapesArchiveRoot(entry.name)) {
      return {
        ok: false,
        reason: "unsafe-entry-name",
        message: "This document contains a part with an unsafe name and was not accepted.",
      };
    }

    if (isMacroPart(entry.name)) {
      return { ok: false, reason: "macros", message: CONTAINS_MACROS_MESSAGE };
    }
  }

  if (expandsTooFar(entries, archive.length)) {
    return { ok: false, reason: "archive-bomb", message: EXPANDS_TOO_FAR_MESSAGE };
  }

  const expectation = FORMAT_EXPECTATIONS[format];
  const contentTypesEntry = entries.find((entry) => entry.name === CONTENT_TYPES_PART);

  // No content-type map at all means this is a ZIP that is not an OOXML package — the state a
  // renamed `.zip` arrives in, having already passed the magic-byte check.
  if (contentTypesEntry === undefined) {
    return { ok: false, reason: "format-mismatch", message: notReallyMessage(format) };
  }

  if (contentTypesEntry.originalSize > MAX_CONTENT_TYPES_BYTES) {
    return { ok: false, reason: "archive-bomb", message: EXPANDS_TOO_FAR_MESSAGE };
  }

  const contentTypes = readContentTypes(archive);

  if (contentTypes === null) {
    return {
      ok: false,
      reason: "unreadable",
      message: `This file could not be opened as a .${format} document.`,
    };
  }

  if (MACRO_CONTENT_TYPE_PATTERN.test(contentTypes)) {
    return { ok: false, reason: "macros", message: CONTAINS_MACROS_MESSAGE };
  }

  const declaresItsFormat =
    contentTypes.includes(expectation.mainPartContentType) &&
    entries.some((entry) => entry.name.startsWith(expectation.partPrefix));

  if (!declaresItsFormat) {
    return { ok: false, reason: "format-mismatch", message: notReallyMessage(format) };
  }

  return { ok: true };
}

const CONTAINS_MACROS_MESSAGE =
  "This document contains macros. Save it in the macro-free format and attach it again.";

const EXPANDS_TOO_FAR_MESSAGE =
  "This document unpacks to far more than its size suggests and was not accepted.";

function notReallyMessage(format: OfficeOpenXmlFormat): string {
  return (
    `This is not really a .${format} document — what is inside it says otherwise. ` +
    "Renaming a file does not change what it is."
  );
}

/**
 * The archive's table of contents, or `null` if it cannot be read as a ZIP at all.
 *
 * The filter returns `false` for every entry, which is the point: fflate calls it once per
 * central-directory record and skips the ones it refuses, so this walks the whole listing —
 * names, compressed sizes and declared uncompressed sizes — without inflating a single byte.
 */
function listEntries(archive: Uint8Array): UnzipFileInfo[] | null {
  const entries: UnzipFileInfo[] = [];

  try {
    unzipSync(archive, {
      filter: (entry) => {
        entries.push(entry);
        return false;
      },
    });
  } catch {
    return null;
  }

  return entries;
}

/**
 * Whether the archive claims to expand further than any real document would.
 *
 * The sizes come from the ZIP headers and are therefore the archive's own claim, which a hostile
 * file is free to understate. That is fine here: understating them is not an attack, because the
 * bytes are never inflated on the strength of it — only `[Content_Types].xml` is ever
 * decompressed, under its own cap, and it is read inside a `try` so a lying header ends as a
 * rejection rather than as an allocation.
 */
function expandsTooFar(entries: readonly UnzipFileInfo[], archiveBytes: number): boolean {
  let declaredBytes = 0;

  for (const entry of entries) {
    declaredBytes += entry.originalSize;
  }

  return declaredBytes > MAX_DECLARED_BYTES || declaredBytes > archiveBytes * MAX_EXPANSION_RATIO;
}

/**
 * `[Content_Types].xml` as text, or `null` if it will not inflate.
 *
 * The second and last pass over the archive, and the only decompression this module performs.
 * The decoder is lenient — invalid UTF-8 becomes U+FFFD rather than throwing — because the two
 * questions asked of the result are substring searches, and a part mangled enough to decode
 * badly will fail them anyway.
 *
 * The size cap is repeated in the filter rather than relied on from the caller's check, because a
 * ZIP may carry two entries under the same name: the caller measured the first, and this would
 * otherwise inflate the second. Applying it per entry means every copy is measured, and the check
 * on the inflated length afterwards is what holds if the header lied about the size.
 */
function readContentTypes(archive: Uint8Array): string | null {
  try {
    const unzipped = unzipSync(archive, {
      filter: (entry) =>
        entry.name === CONTENT_TYPES_PART && entry.originalSize <= MAX_CONTENT_TYPES_BYTES,
    });
    const part = unzipped[CONTENT_TYPES_PART];

    if (part === undefined || part.length > MAX_CONTENT_TYPES_BYTES) {
      return null;
    }

    return new TextDecoder().decode(part);
  } catch {
    return null;
  }
}

/**
 * Whether an entry's name would resolve outside the archive when written to disk — the zip-slip
 * shape: an absolute path, a Windows drive or UNC prefix, a backslash separator, or a `..`
 * segment.
 *
 * Nothing in this repo extracts an OOXML package today, and that is exactly why the check is
 * here rather than later. The archive is about to be accepted and stored under a village's
 * announcement; whoever adds a preview, a text index or a thumbnailer will extract the file that
 * is already sitting in the bucket, and will be reading these entry names long after the moment
 * anyone was thinking about them.
 */
function escapesArchiveRoot(name: string): boolean {
  if (name === "" || name.startsWith("/") || name.includes("\\")) {
    return true;
  }

  if (/^[a-z]:/iu.test(name)) {
    return true;
  }

  return name.split("/").some((segment) => segment === "..");
}

/** Whether an entry is one of the VBA parts, wherever in the package it has been put. */
function isMacroPart(name: string): boolean {
  const segment = name.split("/").at(-1)?.toLowerCase() ?? "";

  return MACRO_PART_NAMES.includes(segment);
}
