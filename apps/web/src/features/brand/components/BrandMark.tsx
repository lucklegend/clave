import Image from "next/image";

type BrandMarkProps = {
  /**
   * Applied to the wrapper, which is where the size lives: `globals.css` reads `--mark-width`
   * off `.mark`, so a caller sets it here (`[--mark-width:104px]`) rather than trying to
   * override a width the CSS owns. Omitted, the mark keeps its `min(420px, 80%)` default.
   */
  className?: string;
  /**
   * The mark's accessible name. Omit it where the page already names the product in text
   * beside the mark — a second announcement of the same brand is noise, not redundancy.
   */
  label?: string;
};

// Moved here from `features/landing/components/HeroMark.tsx` when `/sign-in` became a second
// caller. Nothing about the mechanism changed, and the reasoning behind it is unchanged too:
//
// Both marks render; `globals.css` shows exactly one, keyed off the same `prefers-color-scheme`
// plus `data-theme` pair as the token blocks. Doing the swap in CSS keeps it correct during SSR —
// no flash, no hydration mismatch — which is why neither <picture> nor a client hook is used. A
// <picture> with a `prefers-color-scheme` media condition cannot see `data-theme` at all.
//
// Both are `priority`. The hidden one is `display:none`, so it sits outside the layout tree and a
// lazy load may never trip for it; a dark-mode reader would get a blank box.
//
// The PNGs are referenced by their `public/` path rather than statically imported: a static import
// would bundle a second, hashed copy of each file alongside the one already served from `public/`.
// Dimensions are the assets' own 420x395, so the optimizer still gets an intrinsic aspect ratio.
export function BrandMark({ className, label }: BrandMarkProps) {
  return (
    <div className={`flex min-w-0 items-center justify-center py-1.5 ${className ?? ""}`}>
      <Image
        className="mark mark-light"
        src="/mark-light.png"
        width={420}
        height={395}
        priority
        alt={label ?? ""}
        // A mark with no label is decoration: `alt=""` alone leaves it in the accessibility
        // tree on some combinations, so the role is removed outright.
        aria-hidden={label === undefined ? true : undefined}
      />
      {/* Same artwork as the light mark and never visible beside it, so it carries no accessible
          name whatever the caller passed — otherwise a screen reader announces the logo twice. */}
      <Image
        className="mark mark-dark"
        src="/mark-dark.png"
        width={420}
        height={395}
        priority
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
