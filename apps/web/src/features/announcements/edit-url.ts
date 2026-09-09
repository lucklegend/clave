/**
 * The edit page's own URL, and the one thing an action is allowed to say through it.
 *
 * Both destructive controls on that page — delete the announcement, remove one of its files —
 * are plain `<form action>` elements in a Server Component. That is deliberate (a mutation
 * behind a GET is followed by every prefetcher that touches the page), and it costs the return
 * channel `useActionState` would have given: a Server Component has no hook to hand a result
 * back to. So a refusal redirects to the page that can draw it, carrying one flag.
 *
 * **A flag and never a message.** The query string is attacker-controlled, and a page that
 * rendered whatever text arrived in it would be a phishing surface with our own chrome around
 * it. `parseEditFailure` answers one of two literals or nothing, and the wording lives in
 * `@clavehq/shared` where the actions and the page cannot disagree about it.
 *
 * Pure, and no `import "server-only"`: the actions build these URLs, the page reads them back,
 * and keeping both halves in one file is what stops the producer and the consumer drifting on a
 * string literal.
 */

/** Which of the edit page's two mutations refused. */
export type EditFailure = "delete" | "attachment";

const EDIT_FAILURES = ["delete", "attachment"] as const satisfies readonly EditFailure[];

const FAILURE_PARAM = "failed";

/** The edit page for `id`, optionally reporting the mutation that just refused. */
export function editAnnouncementHref(id: string, failure?: EditFailure): string {
  const path = `/announcements/${id}/edit`;

  return failure === undefined ? path : `${path}?${FAILURE_PARAM}=${failure}`;
}

/**
 * The failure named in `searchParams.failed`, or `null` for anything else.
 *
 * `string[]` is a shape Next hands over for a repeated query key, so it is answered rather than
 * assumed away — a URL with two `failed` values is a hand-typed one, and the first is as good an
 * answer as any.
 */
export function parseEditFailure(value: string | string[] | undefined): EditFailure | null {
  const candidate = Array.isArray(value) ? value.at(0) : value;

  return EDIT_FAILURES.find((failure) => failure === candidate) ?? null;
}
