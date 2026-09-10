/**
 * What the `@modal` slot renders when nothing has been navigated into it — which is every URL
 * under `/announcements` except the intercepted `/announcements/view/[id]`.
 *
 * **`default.tsx` is not a fallback page and not a loading state.** A parallel slot keeps its own
 * navigation state, and on a *hard* load Next has no state to recover: it does not know what the
 * slot was showing, so it renders `default.tsx` for it. Without this file that is a 404 for the
 * whole route — the board itself would fail to load on a full refresh, because one of its two
 * subtrees has no answer.
 *
 * `null`, because the answer to "no modal is open" is nothing at all. There is no element here to
 * take up space, no empty wrapper, and nothing for the board underneath to lay out around.
 */
export default function ModalSlotDefault() {
  return null;
}
