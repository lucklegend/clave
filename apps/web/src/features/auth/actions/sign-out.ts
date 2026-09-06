"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE } from "../lib/cookies";
import { createSupabaseServerClient } from "../lib/server";

/**
 * Ends the session server-side and clears the marker that governed its cookie lifetime.
 *
 * The marker is deleted explicitly rather than left to expire: leaving it behind would silently
 * make the *next* sign-in on this browser persistent even with the box unticked.
 *
 * Deleted *before* `signOut`, which matters more than it looks. Signing out clears the session
 * cookie by setting it to an empty value, and that write goes through the same lifetime handler
 * in `../lib/server.ts`; with the marker still reading "1" the emptied cookie would be handed
 * back with a fresh 30-day Max-Age and sit in the browser for a month saying nothing. Removing
 * the marker first means the handler sees no preference and writes a session cookie, which the
 * browser discards on close.
 */
export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/sign-in");
}
