import "server-only";

/**
 * The antivirus seam, and the one part of the upload pipeline that reaches outside this process.
 *
 * Everything in `features/announcements/validation/` decides from the bytes in hand: an
 * extension, a magic number, an archive's table of contents. None of that recognises malware. A
 * PDF carrying an exploit is a perfectly well-formed PDF, and a village officer forwarding a
 * document they were emailed is exactly how one arrives. So the last thing the pipeline does
 * before it accepts a file is ask something that keeps a signature database.
 *
 * ## It fails closed, and that is the whole design
 *
 * Every outcome that is not a clear "this file is clean" is a refusal: no scanner configured, a
 * scanner that will not answer, a scanner that times out, a status code we do not recognise, a
 * response we cannot read. **An antivirus integration that passes files when the scanner is down
 * is worse than having none at all, because it is believed.** The first kind of failure is
 * visible — uploads stop working and somebody fixes the scanner. The second kind is invisible
 * until the day it matters, and by then the file is in the bucket.
 *
 * The single documented exception is `ALLOW_UNSCANNED_UPLOADS=1`, which exists so that a
 * developer can work on the announcement board without running a signature database on their
 * laptop. It applies only when no scanner is configured at all — it is not an override for a
 * scanner that is failing — and it is ignored in a production build, because a flag that only a
 * comment protects is a flag that eventually gets set in production.
 *
 * ## Shape of the endpoint
 *
 * `ANTIVIRUS_SCAN_URL` points at a `clamav-rest`-shaped scanner: a multipart POST of the file,
 * answered with **200 for clean and 406 for infected**. `docker-compose.yml` at the repo root
 * runs one locally.
 *
 * The verdict is taken from the status code and never from the response body. The body's shape
 * differs between forks and between versions of the same fork — a bare object in one, an array
 * of per-file results in another — and a parser that guesses wrong about a *clean* response
 * refuses everything, while one that guesses wrong about an *infected* response accepts malware.
 * The status codes are the part every variant agrees on. The body is read only to name the
 * signature in the log, where being wrong costs nothing.
 */

/**
 * What a scanner answers about one file.
 *
 * Two states, not three, and the missing third is deliberate: there is no "could not scan"
 * variant, because the caller must not be able to treat one differently from an infection. A
 * scanner that did not answer has not told us the file is safe, and that is the only question
 * this type exists to settle. `signature` names *why* — a ClamAV signature for a real detection,
 * one of the sentinels below for an operational failure — so the reason reaches a log without
 * reaching the person uploading, who is told only that the file was not accepted.
 */
export type ScanVerdict = { clean: true } | { clean: false; signature: string };

/** The bytes to scan, and the name they are announced under in the multipart body. */
export type ScannableFile = {
  bytes: Uint8Array;
  /**
   * Already through `sanitiseFileName` by the time it arrives, so it carries no control
   * characters and no quote to break out of the `Content-Disposition` this is written into.
   */
  fileName: string;
};

/**
 * The injectable form of {@link scanFile}. `attachments.ts` takes one of these as a parameter
 * rather than importing the implementation, so a caller can see which scanner a pipeline runs
 * against and can substitute one that does not cost a network round trip.
 */
export type FileScanner = (file: ScannableFile) => Promise<ScanVerdict>;

/** No `ANTIVIRUS_SCAN_URL`, and no development flag permitting that. */
const NOT_CONFIGURED_SIGNATURE = "scanner-not-configured";

/** The scanner did not answer at all: refused connection, DNS, TLS, or the timeout below. */
const UNREACHABLE_SIGNATURE = "scanner-unreachable";

/** The scanner answered with something other than the clean/infected pair. */
const UNRECOGNISED_SIGNATURE = "scanner-unrecognised-response";

/** Used when a 406 arrives with a body we could not read a signature out of. */
const UNNAMED_SIGNATURE = "unnamed-detection";

/**
 * Ninety seconds. Generous, because ClamAV scanning a 10 MB Office document genuinely takes
 * seconds, and a scan refused for being slow is an upload the officer has to repeat. It is
 * bounded rather than absent because `fetch` without a signal waits on the platform default,
 * which on a hung socket is minutes — long enough to hold the server action open until something
 * less informative times out instead.
 */
const SCAN_TIMEOUT_MS = 90_000;

/** 200 is clean and 406 is infected across every `clamav-rest` variant. */
const CLEAN_STATUS = 200;
const INFECTED_STATUS = 406;

/**
 * Scan one file, and refuse it on anything short of a clear pass.
 *
 * This is the default `FileScanner`, and the one the save action injects into the pipeline.
 */
export async function scanFile(file: ScannableFile): Promise<ScanVerdict> {
  const scanUrl = process.env.ANTIVIRUS_SCAN_URL;

  if (scanUrl === undefined || scanUrl === "") {
    if (unscannedUploadsAllowed()) {
      return { clean: true };
    }

    console.error(
      "ANTIVIRUS_SCAN_URL is not set, so every attachment is being refused. Run the scanner " +
        "with `docker compose up -d`, or set ALLOW_UNSCANNED_UPLOADS=1 for local development.",
    );

    return { clean: false, signature: NOT_CONFIGURED_SIGNATURE };
  }

  const body = new FormData();

  // The filename is what a `clamav-rest` reads to decide a multipart part is a file at all — the
  // Go implementation skips every part that does not carry one.
  //
  // `new Uint8Array(...)` around the bytes is a copy, and it is there because `Blob` only accepts
  // a view onto a plain `ArrayBuffer` while the pipeline's bytes may sit on anything the runtime
  // chose — `sharp` returns a `Buffer` whose backing store the type system describes as
  // `ArrayBufferLike`, which includes `SharedArrayBuffer`. Copying is the narrowing; the
  // alternative is an assertion, and a cast is a worse trade than one memcpy per scanned file.
  body.append("file", new Blob([new Uint8Array(file.bytes)]), file.fileName);

  const response = await postToScanner(scanUrl, body);

  if (response === null) {
    return { clean: false, signature: UNREACHABLE_SIGNATURE };
  }

  if (response.status === CLEAN_STATUS) {
    return { clean: true };
  }

  if (response.status === INFECTED_STATUS) {
    return { clean: false, signature: await readSignature(response) };
  }

  // 400 (ClamAV itself errored), 413 (the scanner's own size limit), 422, 501 — and anything a
  // proxy in front of the scanner might answer. None of them says the file is clean.
  console.error(`Virus scanner answered ${response.status}; refusing the upload.`);

  return { clean: false, signature: UNRECOGNISED_SIGNATURE };
}

/**
 * Whether the local-development escape hatch applies.
 *
 * Two conditions, and the second is the one that matters. `NODE_ENV` is `"production"` for
 * `next build` and `next start`, so a deployed instance ignores this flag however its
 * environment was filled in. The flag exists to let someone run `next dev` against a local
 * Supabase without a signature database on their machine; carrying that into a deployment would
 * silently disable the last check in the pipeline.
 */
function unscannedUploadsAllowed(): boolean {
  return process.env.ALLOW_UNSCANNED_UPLOADS === "1" && process.env.NODE_ENV !== "production";
}

/**
 * POST to the scanner, or `null` if it did not answer.
 *
 * Every transport failure collapses to `null` — refused connection, DNS, TLS, the abort from the
 * timeout — because the caller does the same thing with all of them. The detail goes to the log,
 * where an operator can act on it.
 */
async function postToScanner(scanUrl: string, body: FormData): Promise<Response | null> {
  try {
    return await fetch(scanUrl, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
      // Nothing about a scan may be served from a cache: the same bytes can be clean today and a
      // known signature tomorrow.
      cache: "no-store",
    });
  } catch (error) {
    console.error("Virus scanner did not answer; refusing the upload.", error);

    return null;
  }
}

/**
 * The signature name out of an infected response, best effort.
 *
 * Purely for the log, so it is deliberately forgiving: the response already means "infected" by
 * its status code, and nothing read here can change that verdict. `clamav-rest` variants answer
 * either `{"Status":"FOUND","Description":"Eicar-Signature"}` or an array of that object, and
 * this reads the description out of both without committing to either shape.
 */
async function readSignature(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  const described = /"Description"\s*:\s*"([^"]+)"/u.exec(text);

  return described?.[1] ?? UNNAMED_SIGNATURE;
}
