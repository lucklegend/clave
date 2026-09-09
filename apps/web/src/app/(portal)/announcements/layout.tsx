/**
 * The announcements segment's own layout, and it exists for exactly one reason: to declare the
 * `@modal` slot alongside `children`.
 *
 * A parallel route is a second subtree rendered in the same layout at the same time. Next only
 * gives a layout a slot prop for a `@folder` that sits beside it, so reading an announcement in a
 * dialog *over* the board — rather than instead of it — needs this file and could not be done
 * from `(portal)/layout.tsx` above.
 *
 * A **Server Component**, and it stays one: it renders two already-rendered subtrees and holds no
 * state. The portal shell above it is untouched, so a soft navigation into the modal re-renders
 * neither the drawer nor the app bar — the board simply stays where it is with a dialog on top.
 *
 * No `<main>` and no chrome of its own. Each page under here renders its own landmark, on the
 * rule `(portal)/layout.tsx` records, and a wrapper element here would put a div between the
 * shell's scrolling column and the page for no one's benefit.
 */
export default function AnnouncementsLayout({ children, modal }: LayoutProps<"/announcements">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
