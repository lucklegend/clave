import Image from "next/image";

// Both marks render; `globals.css` shows exactly one, keyed off the same `prefers-color-scheme`
// plus `data-theme` pair as the token blocks. Doing the swap in CSS keeps it correct during SSR —
// no flash, no hydration mismatch — which is why neither <picture> nor a client hook is used.
//
// Both are `priority`. The hidden one is `display:none`, so it sits outside the layout tree and a
// lazy load may never trip for it; a dark-mode reader would get a blank box.
//
// The PNGs are referenced by their `public/` path rather than statically imported: a static import
// would bundle a second, hashed copy of each file alongside the one already served from `public/`.
// Dimensions are the assets' own 420x395, so the optimizer still gets an intrinsic aspect ratio.
export function HeroMark() {
  return (
    <div className="flex min-w-0 items-center justify-center py-1.5">
      <Image
        className="mark mark-light"
        src="/mark-light.png"
        width={420}
        height={395}
        priority
        alt="claveHQ — the heartbeat of your community"
      />
      {/* Same artwork as the light mark and never visible beside it, so it carries no accessible
          name — otherwise a screen reader announces the logo twice. */}
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
