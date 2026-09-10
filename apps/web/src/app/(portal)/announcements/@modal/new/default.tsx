/**
 * What the `@modal` slot renders for `/announcements/new` — nothing, and this file is the only
 * way to say so.
 *
 * **Without it, `(.)[id]` swallows this URL.** A parallel slot is matched on its own route tree,
 * not on the one `children` resolved: `children` has a literal `new/` segment and picks it, but
 * the slot has only `(.)[id]` and a root `default.tsx`, and `default.tsx` is consulted solely
 * when *nothing* matches. `new` matches `[id]`. So a soft navigation to the compose page
 * intercepted itself into the dialog with `id === "new"`, `AnnouncementView` failed to parse that
 * as a uuid and called `notFound()`, and the 404 boundary blanked the segment while the portal
 * shell above it kept rendering — a compose page that was blank except for the drawer.
 *
 * Only on a *soft* navigation, which is what made it look intermittent: interception does not run
 * on a hard load, so pasting the same URL rendered the form correctly.
 *
 * A literal segment outranks a dynamic one, so this folder is what stops the interceptor
 * competing for the URL at all — and the slot never runs its own authz read for a route that was
 * never a dialog. **Any future sibling of `[id]` under `/announcements` needs the same file**;
 * `(.)[id]` will match a single segment of any spelling.
 */
export default function ComposeModalSlotDefault() {
  return null;
}
