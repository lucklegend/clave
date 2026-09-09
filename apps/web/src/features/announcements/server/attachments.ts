import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  ATTACHMENT_LIMITS,
  ATTACHMENTS_TOO_LARGE_MESSAGE,
  ATTACHMENT_TOO_LARGE_MESSAGE,
  TOO_MANY_ATTACHMENTS_MESSAGE,
  type AttachmentFormat,
  type AttachmentType,
} from "@clavehq/shared";
import { fileExtension, sanitiseFileName } from "../validation/file-name";
import { inspectFileType } from "../validation/magic-bytes";
import { inspectOfficeArchive, type OfficeOpenXmlFormat } from "../validation/office-zip";
import type { FileScanner } from "./scan";
import { isTranscodableFormat, type TranscodeImage } from "./transcode";

/**
 * The upload pipeline: everything that happens to a file between the form and the bucket.
 *
 * This module composes rather than decides. Each individual check lives somewhere it can be
 * driven with a byte array — `validation/magic-bytes.ts`, `validation/office-zip.ts`,
 * `validation/file-name.ts` — or behind an injected seam — `./transcode.ts`, `./scan.ts`. What is
 * here is the **order**, which is itself security-bearing, and the bookkeeping that turns an
 * accepted file into a row and an object name.
 *
 * ## The order, and why it is this one
 *
 *   1. **Count, then per-file size, then total size.** Free: they read a length. Doing them first
 *      means a caller cannot make the server decode fifty megabytes of image before being told
 *      there are too many files.
 *   2. **Extension on the allowlist, and extension ∧ claimed MIME ∧ leading bytes in agreement.**
 *      Also free, also decides most rejections.
 *   3. **Deep inspection of the OOXML archive**, for the three Office formats. Reads the
 *      archive's table of contents and inflates one small part.
 *   4. **Transcode**, for the three image formats. Expensive — a decode and an encode.
 *   5. **Virus scan.** A network round trip to another process, so it goes last: by the time a
 *      file reaches the scanner, every deterministic reason to refuse it has already been
 *      checked, and the scanner is asked only about files we would otherwise accept.
 *   6. **Checksum and object name**, over the *final* bytes. The checksum describes what is in
 *      the bucket, not what was uploaded, which for an image are different files.
 *
 * Steps 1–3 run over the whole set before any of 4–6 runs over any of it, for the same reason
 * the list is ordered at all: five files where the second is an `.exe` named `.pdf` should cost
 * five length checks and five magic-byte reads, not four transcodes and four virus scans.
 *
 * ## All or nothing
 *
 * A set with any rejection in it is refused entire, and every rejection is reported rather than
 * just the first — the person fixes their attachments once instead of discovering them one at a
 * time. Nothing is written anywhere until every file has passed, so a refusal leaves no object
 * and no row to clean up.
 */

/** One file that passed everything, and what the caller needs to store it. */
export type PreparedAttachment = {
  /** The bytes to upload: re-encoded for an image, byte-for-byte the upload for a document. */
  bytes: Uint8Array;
  /**
   * Sanitised, and carrying the canonical extension of what the bytes *now* are — a `photo.heic`
   * that was converted to JPEG is stored as `photo.jpg`, because this is the name the download
   * is served under and a JPEG called `.heic` opens in nothing.
   */
  fileName: string;
  /** The canonical type from the allowlist. Never the browser's `File.type`. */
  mimeType: string;
  byteSize: number;
  /** Lower-case hex, which is what `announcement_attachments_checksum_format` requires. */
  checksumSha256: string;
  /**
   * `<uuid>.<canonical extension>` — the last segment of the object's path, and the only part of
   * it that this module decides. Generated rather than derived from the upload, so nothing an
   * uploader typed reaches Storage; `attachmentObjectPath` in `./storage.ts` puts the village and
   * the announcement in front of it.
   */
  objectName: string;
};

export type AttachmentRejectionReason =
  | "too-many-files"
  | "file-too-large"
  | "attachments-too-large"
  | "file-type"
  | "office-archive"
  | "image"
  | "not-clean";

export type AttachmentRejection = {
  /**
   * The file this is about, or `null` for the two rules that are about the set rather than any
   * one member of it — a sixth file and a total over the cap both name no filename, because
   * neither is any particular file's fault.
   */
  fileName: string | null;
  reason: AttachmentRejectionReason;
  /** Already prefixed with the filename where there is one, ready to show. */
  message: string;
};

export type AttachmentPreparation =
  | { ok: true; attachments: readonly PreparedAttachment[] }
  | { ok: false; rejections: readonly AttachmentRejection[] };

/**
 * Everything the pipeline reaches outside itself for.
 *
 * A required parameter rather than a default, so that the two libraries and the network call are
 * visible where `prepareAttachments` is invoked. The save action passes `transcodeImage` and
 * `scanFile`; a caller that wants neither — a test, or a script checking a corpus of documents —
 * passes its own and gets the same ordering without `sharp`, WebAssembly or a scanner container.
 */
export type AttachmentPipeline = {
  transcodeImage: TranscodeImage;
  scanFile: FileScanner;
};

/**
 * Run every uploaded file through the pipeline, and hand back either all of them prepared or all
 * the reasons none of them were.
 *
 * `files` are the `File` entries the server action pulled out of its `FormData`. Their `size` and
 * `type` are not trusted for anything: sizes are measured from the bytes actually received, and
 * the type is only ever checked *against* what the extension and the magic bytes already agreed.
 */
export async function prepareAttachments(
  files: readonly File[],
  pipeline: AttachmentPipeline,
): Promise<AttachmentPreparation> {
  if (files.length === 0) {
    return { ok: true, attachments: [] };
  }

  if (files.length > ATTACHMENT_LIMITS.maxFiles) {
    return refuse([setRejection("too-many-files", TOO_MANY_ATTACHMENTS_MESSAGE)]);
  }

  const uploads = await Promise.all(files.map(readUpload));
  const sizeRejections = rejectOnSize(uploads);

  if (sizeRejections.length > 0) {
    return refuse(sizeRejections);
  }

  const inspected: InspectedUpload[] = [];
  const inspectionRejections: AttachmentRejection[] = [];

  for (const upload of uploads) {
    const outcome = inspect(upload);

    if (outcome.ok) {
      inspected.push(outcome.upload);
    } else {
      inspectionRejections.push(outcome.rejection);
    }
  }

  if (inspectionRejections.length > 0) {
    return refuse(inspectionRejections);
  }

  return finalise(inspected, pipeline);
}

/** An uploaded file with its bytes read and its name taken apart. */
type Upload = {
  /** From the *original* name, before sanitising, since sanitising is about display. */
  extension: string;
  /** The browser's `File.type`, carried only so `inspectFileType` can check it for agreement. */
  claimedMimeType: string;
  fileName: string;
  bytes: Uint8Array;
};

/** An upload that has been identified: same bytes, plus the allowlist entry they match. */
type InspectedUpload = Upload & { type: AttachmentType };

async function readUpload(file: File): Promise<Upload> {
  return {
    extension: fileExtension(file.name),
    claimedMimeType: file.type,
    fileName: sanitiseFileName(file.name),
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

/**
 * The two size caps, measured on the bytes rather than on `File.size`.
 *
 * The per-file cap is reported per file, so someone attaching four documents and one enormous
 * one is told which one to drop. The total is reported once, because no single file is the reason
 * a set is over it.
 */
function rejectOnSize(uploads: readonly Upload[]): AttachmentRejection[] {
  const rejections: AttachmentRejection[] = [];
  let totalBytes = 0;

  for (const upload of uploads) {
    totalBytes += upload.bytes.length;

    if (upload.bytes.length > ATTACHMENT_LIMITS.maxBytesPerFile) {
      rejections.push(
        fileRejection(upload.fileName, "file-too-large", ATTACHMENT_TOO_LARGE_MESSAGE),
      );
    }
  }

  if (totalBytes > ATTACHMENT_LIMITS.maxBytesTotal) {
    rejections.push(setRejection("attachments-too-large", ATTACHMENTS_TOO_LARGE_MESSAGE));
  }

  return rejections;
}

/**
 * Steps 2 and 3: what the file claims to be, whether its bytes agree, and — for an Office
 * package — what is inside it.
 *
 * Both checks are pure and both are cheap, which is why they run over every file before anything
 * expensive runs over any of them.
 */
function inspect(
  upload: Upload,
): { ok: true; upload: InspectedUpload } | { ok: false; rejection: AttachmentRejection } {
  const inspection = inspectFileType({
    bytes: upload.bytes,
    extension: upload.extension,
    claimedMimeType: upload.claimedMimeType,
  });

  if (!inspection.ok) {
    return {
      ok: false,
      rejection: fileRejection(upload.fileName, "file-type", inspection.message),
    };
  }

  const { type } = inspection;

  if (isOfficeOpenXmlFormat(type.format)) {
    const archive = inspectOfficeArchive(upload.bytes, type.format);

    if (!archive.ok) {
      return {
        ok: false,
        rejection: fileRejection(upload.fileName, "office-archive", archive.message),
      };
    }
  }

  return { ok: true, upload: { ...upload, type } };
}

/**
 * Steps 4 to 6, over files that have already passed everything cheap.
 *
 * Sequential rather than concurrent, deliberately. Five simultaneous image decodes is five times
 * the peak memory on a server sized for one, and five simultaneous multipart POSTs is a way to
 * make a single upload form look like a load test to the scanner. The set is capped at five
 * files, so the latency this costs is bounded and small.
 */
async function finalise(
  uploads: readonly InspectedUpload[],
  pipeline: AttachmentPipeline,
): Promise<AttachmentPreparation> {
  const attachments: PreparedAttachment[] = [];
  const rejections: AttachmentRejection[] = [];

  for (const upload of uploads) {
    const outcome = await prepareOne(upload, pipeline);

    if (outcome.ok) {
      attachments.push(outcome.attachment);
    } else {
      rejections.push(outcome.rejection);
    }
  }

  if (rejections.length > 0) {
    return refuse(rejections);
  }

  return { ok: true, attachments };
}

async function prepareOne(
  upload: InspectedUpload,
  pipeline: AttachmentPipeline,
): Promise<
  { ok: true; attachment: PreparedAttachment } | { ok: false; rejection: AttachmentRejection }
> {
  let { bytes, fileName, type } = upload;

  if (isTranscodableFormat(type.format)) {
    const transcoded = await pipeline.transcodeImage({ bytes, format: type.format });

    if (!transcoded.ok) {
      return { ok: false, rejection: fileRejection(fileName, "image", transcoded.message) };
    }

    // The type can change here — HEIC comes out as JPEG — so the canonical MIME type, the object
    // name's extension and the displayed filename all follow the transcode's answer rather than
    // the upload's. Never the other way round: the bytes are the fact.
    bytes = transcoded.bytes;
    type = transcoded.type;
    fileName = withCanonicalExtension(fileName, type.extension);
  }

  const verdict = await pipeline.scanFile({ bytes, fileName });

  if (!verdict.clean) {
    // The signature is logged and not shown. A person uploading a file has no use for a ClamAV
    // signature name, and the sentinels `./scan.ts` returns for an unreachable scanner would tell
    // whoever is probing exactly which failure mode they had found and how to wait it out.
    console.error(`Refusing attachment "${fileName}": ${verdict.signature}.`);

    return { ok: false, rejection: fileRejection(fileName, "not-clean", NOT_CLEAN_MESSAGE) };
  }

  return {
    ok: true,
    attachment: {
      bytes,
      fileName,
      mimeType: type.mimeType,
      byteSize: bytes.length,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      objectName: `${randomUUID()}.${type.extension}`,
    },
  };
}

/**
 * One message for an infection and for every way the scanner failed to clear a file.
 *
 * The same argument as the sign-in form's single rejection message: distinguishing "this file is
 * infected" from "the scanner is down" tells someone probing the difference between a file worth
 * re-encoding and a window worth waiting for. Neither is the uploader's problem to solve, and
 * both have the same next step.
 */
const NOT_CLEAN_MESSAGE =
  "This file could not be cleared by the virus scanner and was not attached. Check it on your " +
  "own machine, and tell your village administrator if you believe it is safe.";

function refuse(rejections: readonly AttachmentRejection[]): AttachmentPreparation {
  return { ok: false, rejections };
}

function setRejection(reason: AttachmentRejectionReason, message: string): AttachmentRejection {
  return { fileName: null, reason, message };
}

function fileRejection(
  fileName: string,
  reason: AttachmentRejectionReason,
  message: string,
): AttachmentRejection {
  return { fileName, reason, message: `${fileName} — ${message}` };
}

/** Whether a format is one of the three ZIP-based Office packages `office-zip.ts` can inspect. */
function isOfficeOpenXmlFormat(format: AttachmentFormat): format is OfficeOpenXmlFormat {
  return format === "docx" || format === "xlsx" || format === "pptx";
}

/**
 * `fileName` with its extension replaced, and never longer than it already was.
 *
 * The length clause is the only interesting part. `sanitiseFileName` has already capped the name
 * at the 255 characters `announcement_attachments_file_name_length` allows, and swapping a short
 * extension for a longer one could push it back over — so the stem gives up exactly as many
 * characters as the new suffix takes. Counted in code points rather than UTF-16 units for the
 * reason `validation/file-name.ts` spells out: Postgres counts characters, and one emoji in a
 * filename is the difference.
 */
function withCanonicalExtension(fileName: string, extension: string): string {
  const dot = fileName.lastIndexOf(".");
  const stem = Array.from(dot > 0 ? fileName.slice(0, dot) : fileName);
  const suffix = `.${extension}`;
  const room = Array.from(fileName).length - Array.from(suffix).length;

  // At least one character of stem, for the pathological case of a name shorter than the
  // extension being put on it. Such a name is nowhere near the cap, so nothing is at risk.
  return `${stem.slice(0, Math.max(room, 1)).join("")}${suffix}`;
}
