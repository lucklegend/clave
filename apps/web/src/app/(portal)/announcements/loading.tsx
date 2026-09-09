/**
 * The board while its read is in flight — `(portal)/loading.tsx`'s pattern, shaped for this
 * page's own blocks (headline, filter, table, pager) rather than the generic four-tile grid that
 * skeleton draws. `animate-pulse` and no `motion-reduce:` companion for the same reason that file
 * gives: `globals.css`'s blanket transition kill already leaves a still block as the correct
 * static state under `prefers-reduced-motion`.
 */
export default function AnnouncementsLoading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-[1180px] animate-pulse px-[22px] pt-11 pb-14"
    >
      <span className="sr-only">Loading</span>

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="h-9 w-[36ch] max-w-full rounded-m bg-surface-container-high" />
          <div className="mt-3 h-6 w-full max-w-[52ch] rounded-m bg-surface-container" />
        </div>
        <div className="mt-1 h-10 w-[13ch] shrink-0 rounded-full bg-surface-container-high" />
      </div>

      <div className="mt-6 mb-4 h-10 w-[420px] max-w-full rounded-full bg-surface-container" />

      <div className="rounded-m border border-outline-variant bg-surface p-4">
        <div className="h-9 rounded-s bg-surface-container-low" />
        <div className="mt-3 flex flex-col gap-3">
          <div className="h-14 rounded-s bg-surface-container-low" />
          <div className="h-14 rounded-s bg-surface-container-low" />
          <div className="h-14 rounded-s bg-surface-container-low" />
          <div className="h-14 rounded-s bg-surface-container-low" />
          <div className="h-14 rounded-s bg-surface-container-low" />
        </div>
        <div className="mt-4 h-12 rounded-s bg-surface-container-low" />
      </div>
    </div>
  );
}
