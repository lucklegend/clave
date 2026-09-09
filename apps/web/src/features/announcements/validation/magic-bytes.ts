import { findAttachmentTypeByExtension, type AttachmentType } from "@clavehq/shared";

/**
 * What an attachment actually is, decided from its leading bytes.
 *
 * Pure, over a `Uint8Array`, with no I/O and deliberately no `import "server-only"`. The bytes
 * are supplied by the caller — the server pipeline reads them from the uploaded `File` — which
 * keeps the security-bearing logic something a test can drive with a byte array it wrote itself.
 *
 * Three claims arrive with every upload and all three have to agree before the file is accepted:
 * the extension the person typed, the MIME type the browser attached, and the bytes. Only the
 * last of those is evidence. **`File.type` is a hint from the client and is never the decision** —
 * the operating system derives it from the extension, so it is exactly as trustworthy as the
 * extension is, which is not at all. It is checked only because a *disagreement* between two
 * client-supplied claims is itself a reason to stop.
 */
export type FileTypeInspection =
  | { ok: true; type: AttachmentType }
  | { ok: false; reason: FileTypeRejectionReason; message: string };

export type FileTypeRejectionReason =
  "empty" | "extension-not-allowed" | "mime-type-disagrees" | "content-disagrees";

/** Everything the board takes, in the words a person uses for them. */
const ACCEPTED_TYPES_SENTENCE =
  "Attach a PDF, Word, Excel or PowerPoint document, or a JPEG, PNG or HEIC image.";

/**
 * Decides an upload's type, or says why it will not be accepted.
 *
 * Returns a discriminated result rather than a boolean so that a rejection carries a reason the
 * caller can put in front of a person — prefixed with the filename, which this function never
 * sees, because the sanitised name is the caller's to hold.
 *
 * On success the returned entry is the allowlist's, so the canonical MIME type and canonical
 * extension the rest of the pipeline uses come from the table and not from the upload.
 */
export function inspectFileType(candidate: {
  bytes: Uint8Array;
  /** Lower-cased and without its dot — what `fileExtension` in `./file-name` returns. */
  extension: string;
  /** The browser's `File.type`, which may legitimately be empty. */
  claimedMimeType: string;
}): FileTypeInspection {
  if (candidate.bytes.length === 0) {
    return { ok: false, reason: "empty", message: "This file is empty." };
  }

  const type = findAttachmentTypeByExtension(candidate.extension);

  if (type === undefined) {
    return {
      ok: false,
      reason: "extension-not-allowed",
      message: `That kind of file cannot be attached. ${ACCEPTED_TYPES_SENTENCE}`,
    };
  }

  if (!claimAgrees(candidate.claimedMimeType, type.mimeType)) {
    return {
      ok: false,
      reason: "mime-type-disagrees",
      message: `The browser described this file as something other than a .${type.extension} file.`,
    };
  }

  if (!contentAgrees(candidate.bytes, type.magic)) {
    return {
      ok: false,
      reason: "content-disagrees",
      message:
        `This is not really a .${type.extension} file — its contents say otherwise. ` +
        "Renaming a file does not change what it is.",
    };
  }

  return { ok: true, type };
}

/**
 * Whether the browser's claimed MIME type contradicts the type the extension chose.
 *
 * **An empty claim is not a contradiction**, and that concession is load-bearing rather than
 * lax. A browser fills `File.type` from an operating-system registry, and for HEIC there is
 * frequently no entry: Chrome and Firefox on Windows hand over `""` for a photograph straight
 * off an iPhone. Treating that as a mismatch would reject the format the ticket specifically
 * asked for, on the platform most officers use.
 *
 * Nothing is lost by allowing it. The claim is client-supplied, so an attacker can set it to
 * whatever the extension implies just as easily as leaving it blank; the two checks that decide
 * anything are the extension and the bytes, and both still have to pass.
 *
 * Parameters are stripped first (`image/jpeg; charset=binary` is a claim of `image/jpeg`).
 */
function claimAgrees(claimed: string, canonical: string): boolean {
  const [essence = ""] = claimed.split(";");
  const normalised = essence.trim().toLowerCase();

  return normalised === "" || normalised === canonical;
}

/**
 * Whether the leading bytes carry the signature the allowlist records for this type.
 *
 * The signatures themselves live in `ATTACHMENT_TYPES`, so this file holds no byte literals: a
 * new accepted type is a row in that table, not an edit here. The switch is exhaustive over the
 * `magic.kind` union, so adding a third kind of signature stops the build rather than silently
 * falling through to "no".
 *
 * A pass here means "the container is right", not "the document is safe". All three OOXML types
 * share the ZIP signature, so for those this only establishes that the file is an archive —
 * which archive it is, and whether it carries macros, is `./office-zip`'s question.
 */
function contentAgrees(bytes: Uint8Array, magic: AttachmentType["magic"]): boolean {
  switch (magic.kind) {
    case "prefix":
      return startsWith(bytes, magic.bytes);
    case "isoBaseMedia":
      return hasIsoBaseMediaBrand(bytes, magic.brands);
  }
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) {
    return false;
  }

  return prefix.every((byte, index) => bytes[index] === byte);
}

/** Offset of the four-character box type in an ISO base media file's first box. */
const BOX_TYPE_OFFSET = 4;

/** Offset of the major brand, which is the first field of an `ftyp` box's payload. */
const MAJOR_BRAND_OFFSET = 8;

const FOUR_CHARACTER_CODE_LENGTH = 4;

/**
 * Whether the file is an ISO base media container whose major brand is one of `brands`.
 *
 * HEIC, MP4, MOV and AVIF are all ISO base media files and all open with a box whose type is
 * `ftyp`; the major brand that follows is the only thing separating a HEIF still image from a
 * video. Accepting `ftyp` alone would accept an MP4 named `.heic`, which is why the brand list
 * rather than the box type is treated as the signature.
 */
function hasIsoBaseMediaBrand(bytes: Uint8Array, brands: readonly string[]): boolean {
  if (fourCharacterCodeAt(bytes, BOX_TYPE_OFFSET) !== "ftyp") {
    return false;
  }

  const brand = fourCharacterCodeAt(bytes, MAJOR_BRAND_OFFSET);

  return brand !== null && brands.includes(brand);
}

/** Four bytes read as Latin-1, or `null` if the file is too short to hold them. */
function fourCharacterCodeAt(bytes: Uint8Array, offset: number): string | null {
  if (bytes.length < offset + FOUR_CHARACTER_CODE_LENGTH) {
    return null;
  }

  let code = "";

  for (const byte of bytes.subarray(offset, offset + FOUR_CHARACTER_CODE_LENGTH)) {
    code += String.fromCharCode(byte);
  }

  return code;
}
