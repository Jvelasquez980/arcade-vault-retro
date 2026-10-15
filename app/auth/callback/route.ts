import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-validation";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const base = getSiteUrl();

  if (!code) return NextResponse.redirect(`${base}/auth?error=oauth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${base}/auth?error=oauth`);

  // Usuario OAuth sin perfil: debe elegir su username antes de seguir.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.redirect(
        `${base}/auth/username?next=${encodeURIComponent(next)}`,
      );
    }
  }

  return NextResponse.redirect(`${base}${next}`);
}
