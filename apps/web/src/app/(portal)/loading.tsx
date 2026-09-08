/**
 * The content column while a portal page's reads are in flight.
 *
 * `loading.tsx` beside `layout.tsx` puts its Suspense boundary around the layout's *children*,
 * so the drawer and the app bar are already painted and only the page below them is standing in.
 * That is why this draws blocks the width of a page rather than a whole-screen spinner.
 *
 * `animate-pulse` is the page's one exception to the motion budget, and it needs no
 * `motion-reduce:` companion: the blanket in `globals.css` kills every animation outright, and a
 * still block is the correct static state.
 */
export default function PortalLoading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-[1180px] animate-pulse px-[22px] pt-11 pb-14"
    >
      <span className="sr-only">Loading</span>
      <div className="h-9 w-[18ch] rounded-m bg-surface-container-high" />
      <div className="mt-4 h-6 w-full max-w-[52ch] rounded-m bg-surface-container" />
      <div className="mt-9 grid max-w-[640px] grid-cols-1 gap-4 min-[560px]:grid-cols-2">
        <div className="h-[72px] rounded-m bg-surface-container-low" />
        <div className="h-[72px] rounded-m bg-surface-container-low" />
        <div className="h-[72px] rounded-m bg-surface-container-low" />
        <div className="h-[72px] rounded-m bg-surface-container-low" />
      </div>
    </div>
  );
}
