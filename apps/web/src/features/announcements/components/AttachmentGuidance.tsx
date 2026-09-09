import { ATTACHMENT_LIMITS } from "@clavehq/shared";

/**
 * The compose screen's aside: what happens to a file after it is dropped.
 *
 * It is in the design because none of it is visible and all of it matters — a person handing over
 * a resident's photograph deserves to know the coordinates in it are stripped, and a person whose
 * `.docx` was refused deserves to have been told beforehand that Office files are opened and
 * read. Every line describes something `server/attachments.ts` actually does.
 *
 * A component rather than markup in the two pages, because both of them draw it and sixty lines
 * of prose duplicated is sixty lines that can drift. It is a Server Component: it holds no state
 * and takes no props, so nothing about it belongs in the browser bundle.
 */

// The one number in the copy, read from the shared caps rather than typed into a sentence —
// the same rule the dropzone's own limits line follows.
const PER_FILE_LIMIT = `${ATTACHMENT_LIMITS.maxBytesPerFile / 1_048_576} MB`;

const CHECKS = [
  {
    heading: "The type is read from the bytes",
    detail:
      ", not from the name or from what the browser claims. A program renamed to .pdf is refused.",
  },
  {
    heading: "Office files are opened and inspected.",
    detail: " Anything carrying a macro is refused, however it was named.",
  },
  {
    heading: "Photos are re-encoded.",
    detail:
      " That strips the location a phone writes into a picture, so a resident's home coordinates " +
      "do not travel with the notice.",
  },
  {
    heading: "Everything is scanned",
    detail: " before it is stored, and refused if the scanner cannot be reached.",
  },
  {
    heading: "Files are stored privately",
    detail:
      " and handed out one short-lived link at a time, only to this village. They always download " +
      "rather than opening in the page.",
  },
];

export function AttachmentGuidance() {
  return (
    <aside className="rounded-l bg-surface-container-low p-5">
      <h3 className="title-m text-on-surface">What happens to a file</h3>
      <p className="body-s mt-1 mb-4 text-on-surface-variant">
        Every check runs on the server. None of it can be skipped by the browser.
      </p>

      {CHECKS.map((check) => (
        <div key={check.heading} className="flex gap-3 py-2.5">
          <span className="mt-0.5 shrink-0 text-primary">
            <CheckGlyph />
          </span>
          <span className="body-m text-on-surface-variant">
            <strong className="font-medium text-on-surface">{check.heading}</strong>
            {check.detail}
          </span>
        </div>
      ))}

      {/* `outline-variant` is right here and nowhere on a control: this is a decorative hairline
          between two blocks of prose (D4 rule 1). */}
      <hr className="my-4 h-px border-0 bg-outline-variant" />

      <p className="body-s text-on-surface-variant">
        Refused: <span className="num">.svg</span>, <span className="num">.doc</span>,{" "}
        <span className="num">.xls</span>, <span className="num">.ppt</span>, and anything above{" "}
        <span className="num">{PER_FILE_LIMIT}</span>. SVG is a picture that can run code; the older
        Office formats cannot be inspected the way the new ones can.
      </p>
    </aside>
  );
}

// The aside's tick, 18px, hand-authored on the same precedent as every other glyph in this
// feature — the icon font is subset to the shell's own eleven and a borrowed codepoint would
// render as tofu. `aria-hidden`: it decorates a sentence that already reads as a statement.
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
