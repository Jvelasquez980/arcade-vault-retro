import { redirect } from "next/navigation";
import { NewPasswordForm } from "@/components/recovery-forms";
import { createClient } from "@/lib/supabase/server";

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/recuperar");

  return <NewPasswordForm />;
}
