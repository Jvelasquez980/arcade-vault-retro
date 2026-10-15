import { redirect } from "next/navigation";
import { UsernameForm } from "@/components/username-form";
import { safeNext } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export default async function UsernamePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect(next);

  return <UsernameForm next={next} />;
}
