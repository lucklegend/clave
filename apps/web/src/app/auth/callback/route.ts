import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/features/auth/lib/server";

/**
 * Where Supabase returns the browser after Google has authenticated it.
 *
 * The `code` in the query string is a one-time PKCE authorization code; exchanging it is what
 * sets the session cookies, through the same `setAll` handler that applies the "Remember me"
 * lifetime, so an OAuth sign-in honours the checkbox exactly as a password sign-in does.
 *
 * The destination is a constant. Reading a `next` parameter out of the query string here is the
 * standard way this route becomes an open redirect, and there is no flow yet that needs one.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  // Supabase reports a refused or cancelled consent screen here rather than by omitting `code`.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError !== null) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  const code = searchParams.get("code");
  if (code === null) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
