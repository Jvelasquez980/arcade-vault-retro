import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  return (
    <AuthForm
      next={next}
      error={
        error === "oauth"
          ? "No se pudo iniciar sesión con ese proveedor. Inténtalo de nuevo"
          : undefined
      }
    />
  );
}
