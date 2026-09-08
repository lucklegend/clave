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
// The eyebrow renders `label-l` directly rather than through <Label> (which is `label-m`) — a
// className type-role override cannot beat a same-layer utility declared later in globals.css,
// so `<Label className="label-l">` would silently stay `label-m`.
export function SectionHeading({ id, index, label, heading, note }: SectionHeadingProps) {
  return (
    <div className="mb-7 grid gap-3 min-[860px]:grid-cols-[170px_1fr] min-[860px]:items-start min-[860px]:gap-7">
      <span className="label-l text-on-surface-variant">{`${index} — ${label}`}</span>
      <div>
        <h2 id={id} className="headline-m text-on-surface">
          {heading}
        </h2>
        <p className="body-l mt-2 max-w-[62ch] text-on-surface-variant">{note}</p>
      </div>
    </div>
  );
}
