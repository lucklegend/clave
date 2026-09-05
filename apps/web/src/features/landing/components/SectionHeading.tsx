import { Label } from "./Label";

export type SectionHeadingProps = {
  /** The <h2> id. The owning <section> passes the same value to `aria-labelledby` — a section
   *  with no accessible name is not a landmark at all. */
  id: string;
  /** Two-digit register number, e.g. "01". */
  index: string;
  /** Eyebrow text after the number, e.g. "The statement". */
  label: string;
  heading: string;
  note: string;
};

// The artifact's `.sec-hd`: eyebrow beside a heading-and-note column from 860px, stacked below.
export function SectionHeading({ id, index, label, heading, note }: SectionHeadingProps) {
  return (
    <div className="mb-7 grid gap-3 min-[860px]:grid-cols-[170px_1fr] min-[860px]:items-start min-[860px]:gap-7">
      <Label>{`${index} — ${label}`}</Label>
      <div>
        <h2 id={id} className="text-[clamp(24px,3.2vw,33px)] tracking-[-0.03em]">
          {heading}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14.5px] text-ink-2">{note}</p>
      </div>
    </div>
  );
}
