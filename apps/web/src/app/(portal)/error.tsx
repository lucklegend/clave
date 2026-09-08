"use client";

import { filledButton } from "@/features/brand/cta";

/**
 * A failed read inside a portal page, caught without taking the shell down with it.
 *
 * `error.tsx` beside `layout.tsx` catches what the segment's *children* throw, not what the
 * layout itself does — so the drawer and the app bar survive and the reader can navigate away
 * from a broken page instead of losing the portal.
 *
 * A Client Component because `reset` is an event handler, which is the whole of why this file
 * carries `"use client"` when nothing else in the portal does.
 *
 * The thrown message is not rendered. In production Next replaces it with a digest anyway, and a
 * database error's text is the sort of thing that names a table and a policy to whoever provoked
 * it. The digest is shown when there is one, because it is the string that finds the matching
 * line in the server log and nothing else on the screen can.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-[22px] pt-11 pb-14">
      <h2 className="headline-s text-on-surface">This page did not load</h2>
      <p className="body-l mt-3 max-w-[62ch] text-on-surface-variant">
        Something went wrong fetching what belongs here. Nothing was changed, and the rest of the
        portal is still working.
      </p>
      {error.digest !== undefined && (
        <p className="body-m num mt-3 text-on-surface-variant">Reference {error.digest}</p>
      )}
      <button type="button" onClick={reset} className={`${filledButton} mt-8`}>
        Try again
      </button>
    </main>
  );
}
