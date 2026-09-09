import "server-only";

import sharp from "sharp";
import { ATTACHMENT_TYPES, type AttachmentFormat, type AttachmentType } from "@clavehq/shared";

/**
 * Image re-encoding, and the reason no uploaded image is ever stored as it arrived.
 *
 * Three things happen when a photograph is decoded and written out again, and only the third is
 * about display:
 *
 *   1. **The metadata goes.** A phone photograph carries EXIF, and EXIF carries GPS coordinates.
 *      An officer attaching a picture of a broken gate would otherwise publish the location, the
 *      timestamp, the device serial and whatever else the camera app wrote, to everyone in the
 *      village with a download link. `sharp` keeps no metadata unless asked to, so a plain
 *      re-encode drops all of it — this module never calls `keepMetadata` or `withMetadata`, and
 *      that omission is the feature.
 *   2. **A polyglot stops being one.** A file that is a valid JPEG *and* a valid HTML document,
 *      or a JPEG with a PHP payload appended past the end-of-image marker, survives every check
 *      in `features/announcements/validation/` — all of them are true statements about the front
 *      of the file. Decoding to pixels and encoding fresh produces a file built from the pixels
 *      alone; anything that was riding along in the container is simply not copied.
 *   3. **HEIC becomes JPEG**, because no browser renders HEIC and an attachment nobody can open
 *      is not an attachment.
 *
 * ## Why two decoders
 *
 * The two builds on this machine are exactly complementary, which is not obvious and cost a
 * probe to establish (`.agent-work/0010-announcement-board/heic-probe.md`):
 *
 *   * `sharp`'s bundled libvips reports `heif.input.file === true`, which reads like HEIC
 *     support and is not — that flag describes the format table, not the codecs. Its versions
 *     block lists `aom` and no `libde265`, so it decodes AV1-in-HEIF and nothing else. An iPhone
 *     writes HEVC. Handing one to `sharp` fails.
 *   * `libheif-js`'s WebAssembly build is the mirror image: `libde265` is compiled in and there
 *     is no AV1 decoder at all. It is the one that reads a photograph off a phone.
 *
 * So HEIC decodes through `libheif-js` and everything encodes through `sharp`. Both branches end
 * in a `sharp` encode, which is what makes the metadata and polyglot guarantees above identical
 * however the image arrived.
 */

/** The formats that go through this module. Everything else on the allowlist is a document. */
export type TranscodableFormat = Extract<AttachmentFormat, "jpeg" | "png" | "heic">;

/**
 * The outcome of a transcode.
 *
 * `type` is the allowlist entry for what came *out*, which is not always what went in: a HEIC
 * arrives as `image/heic` and leaves as `image/jpeg` under a `.jpg` extension. The caller stores
 * the object under this entry's canonical MIME type and extension, so the bytes in the bucket
 * and the row describing them cannot disagree.
 */
export type ImageTranscode =
  { ok: true; bytes: Uint8Array; type: AttachmentType } | { ok: false; message: string };

/**
 * The injectable form of {@link transcodeImage}, taken as a parameter by the pipeline in
 * `./attachments.ts` so that the two image libraries are visible at the call site rather than
 * reached for inside it.
 */
export type TranscodeImage = (image: {
  bytes: Uint8Array;
  format: TranscodableFormat;
}) => Promise<ImageTranscode>;

/**
 * Fifty megapixels, which is roughly twice the largest sensor in a phone and far below anything
 * a village officer photographs a notice with.
 *
 * This is the image-decompression-bomb cap. Ten megabytes of upload — the per-file limit — is
 * ample room for a PNG that claims to be 40,000 pixels square, and decoding one allocates about
 * six gigabytes of RGBA before anything else in the pipeline gets a say. `sharp` applies its own
 * default limit, but the HEIC branch decodes outside `sharp` entirely, so the dimensions coming
 * back from `libheif-js` are checked against this before a buffer is allocated for them.
 */
const MAX_PIXELS = 50_000_000;

/**
 * Quality 82. Visually indistinguishable from the original for a document photograph, and a
 * meaningful fraction of the size — which matters because the re-encoded bytes are what count
 * against the storage bucket, not the bytes that were uploaded.
 */
const JPEG_QUALITY = 82;

const COULD_NOT_READ_MESSAGE =
  "This image could not be read. Open it, re-save it, and attach it again.";

/**
 * Named separately from the general failure above because it is the one with a known cause worth
 * distinguishing in a report: a HEIC variant this build cannot decode. It says nothing about
 * codecs to the person holding it, only what to do.
 */
const HEIC_COULD_NOT_DECODE_MESSAGE =
  "This HEIC image could not be converted. Export it as a JPEG and attach that instead.";

/**
 * Whether a format is an image this module handles.
 *
 * A type guard rather than a comparison at the call site, so the pipeline narrows `format` on the
 * way into {@link transcodeImage} and the compiler — not a comment — is what guarantees a PDF
 * never reaches an image decoder.
 */
export function isTranscodableFormat(format: AttachmentFormat): format is TranscodableFormat {
  return format === "jpeg" || format === "png" || format === "heic";
}

/**
 * Decode an uploaded image and encode it again, or say why it could not be.
 *
 * The default `TranscodeImage`, and the one the save action injects into the pipeline. It never
 * falls back to the original bytes: a file that cannot be decoded is a file whose contents we
 * cannot vouch for, and storing it unchanged would give up both guarantees this module exists
 * for at exactly the moment they are least deserved.
 */
export async function transcodeImage(image: {
  bytes: Uint8Array;
  format: TranscodableFormat;
}): Promise<ImageTranscode> {
  if (image.format === "heic") {
    return transcodeHeicToJpeg(image.bytes);
  }

  return reencode(image.bytes, image.format);
}

/**
 * A JPEG or PNG through `sharp` and back out in the same format.
 *
 * `limitInputPixels` is passed explicitly rather than left at the library default so that the
 * cap this module enforces is one number, shared with the HEIC branch, and visible here.
 */
async function reencode(bytes: Uint8Array, format: "jpeg" | "png"): Promise<ImageTranscode> {
  try {
    const decoded = sharp(bytes, { limitInputPixels: MAX_PIXELS });

    if (format === "png") {
      return { ok: true, bytes: await decoded.png().toBuffer(), type: PNG_TYPE };
    }

    return {
      ok: true,
      bytes: await decoded.jpeg({ quality: JPEG_QUALITY }).toBuffer(),
      type: JPEG_TYPE,
    };
  } catch {
    // Anything `sharp` throws means the same thing here — truncated file, a format it will not
    // read, an image past the pixel cap — and the person's next step is the same for all of
    // them. The distinction would only matter to a log, and the bytes are not ours to keep.
    return { ok: false, message: COULD_NOT_READ_MESSAGE };
  }
}

/** A HEIC decoded to raw RGBA by `libheif-js`, then encoded to JPEG by `sharp`. */
async function transcodeHeicToJpeg(bytes: Uint8Array): Promise<ImageTranscode> {
  const decoded = await decodeHeic(bytes);

  if (decoded === null) {
    return { ok: false, message: HEIC_COULD_NOT_DECODE_MESSAGE };
  }

  try {
    const encoded = await sharp(decoded.data, {
      // Raw pixels, so `sharp` has no header to read the geometry from and is told it instead.
      // Four channels because `libheif-js` always renders RGBA, alpha included.
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
      limitInputPixels: MAX_PIXELS,
    })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    return { ok: true, bytes: encoded, type: JPEG_TYPE };
  } catch {
    return { ok: false, message: HEIC_COULD_NOT_DECODE_MESSAGE };
  }
}

/**
 * The first top-level image of a HEIF container as RGBA, or `null` if it will not decode.
 *
 * Imported dynamically, and only on the branch that needs it: the WebAssembly bundle is two
 * megabytes and every millisecond of parsing it would otherwise be paid on a request that
 * uploaded a PDF.
 *
 * *First* top-level image, not "the primary": a burst or a Live Photo carries several, and
 * `libheif-js` hands back the file's own order. That is the frame a phone's gallery shows first
 * and the one an officer means when they attach the photo.
 *
 * The dimensions are read and checked **before** the RGBA buffer is allocated, which is the
 * whole reason this is a separate function rather than four lines inline — the allocation is
 * `width * height * 4` bytes taken on the say-so of a header in the uploaded file.
 */
async function decodeHeic(bytes: Uint8Array): Promise<HeifSurface | null> {
  try {
    const libheif = (await import("libheif-js/wasm-bundle.js")).default;
    const image = new libheif.HeifDecoder().decode(bytes).at(0);

    if (image === undefined) {
      return null;
    }

    const width = image.get_width();
    const height = image.get_height();

    if (width <= 0 || height <= 0 || width * height > MAX_PIXELS) {
      return null;
    }

    const surface = { data: new Uint8ClampedArray(width * height * 4), width, height };

    return await new Promise<HeifSurface | null>((resolve) => {
      // `display` reports a failed decode by calling back with nothing rather than by throwing,
      // which is how a container whose codec is missing from this build arrives here.
      image.display(surface, (result) => resolve(result ?? null));
    });
  } catch {
    return null;
  }
}

type HeifSurface = { data: Uint8ClampedArray; width: number; height: number };

/**
 * The allowlist entry for a format, resolved once when this module is first loaded.
 *
 * `AttachmentFormat` is derived from `ATTACHMENT_TYPES` itself, so a format with no entry cannot
 * be constructed and the throw below is structurally unreachable — but `find` returns
 * `AttachmentType | undefined` and a non-null assertion is not available to us. The throw is how
 * the compiler learns the value is there, and it costs nothing: it can only fire if the
 * allowlist ever loses one of these rows, in which case it fires at import, loudly, rather than
 * months later on somebody's upload.
 */
function attachmentTypeForFormat(format: AttachmentFormat): AttachmentType {
  const type = ATTACHMENT_TYPES.find((entry) => entry.format === format);

  if (type === undefined) {
    throw new Error(`ATTACHMENT_TYPES has no entry for the "${format}" format.`);
  }

  return type;
}

/** What a HEIC becomes, and what a JPEG stays. Carries the canonical `.jpg` and `image/jpeg`. */
const JPEG_TYPE = attachmentTypeForFormat("jpeg");

const PNG_TYPE = attachmentTypeForFormat("png");
