"use server";

import { redirect } from "next/navigation";
import {
  emailError,
  normalizeUsername,
  safeNext,
  usernameError,
  validateSignUp,
  passwordError,
  type AuthField,
  type AuthState,
} from "@/lib/auth-validation";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

const fail = (
  error: string,
  field?: AuthField,
  values?: AuthState["values"],
): AuthState => ({ error, field, values });

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const input = {
    username: text(formData, "username"),
    email: text(formData, "email"),
    password: text(formData, "password"),
  };
  const values = {
    username: normalizeUsername(input.username),
    email: input.email.trim(),
  };

  const parsed = validateSignUp(input);
  if (!parsed.ok) {
    const field: AuthField = usernameError(values.username)
      ? "username"
      : emailError(values.email)
        ? "email"
        : "password";
    return fail(parsed.error, field, values);
  }
  const { username, email, password } = parsed.value;

  const supabase = await createClient();

  // Chequeo previo para un error temprano; el índice único es la verdad.
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (taken) return fail("Ese usuario ya existe", "username", values);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    // El trigger falla por el índice único (carrera): Supabase lo reporta así.
    if (/database error saving new user/i.test(error.message)) {
      return fail("Ese usuario ya existe", "username", values);
    }
    if (error.code === "email_address_invalid") {
      return fail("Correo inválido", "email", values);
    }
    if (error.code === "weak_password") {
      return fail("Contraseña demasiado débil", "password", values);
    }
    return fail(
      "No se pudo crear la cuenta. Inténtalo de nuevo",
      undefined,
      values,
    );
  }
  if (!data.session) {
    return fail(
      "No se pudo iniciar sesión. Inténtalo de nuevo",
      undefined,
      values,
    );
  }

  redirect(safeNext(text(formData, "next")));
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  const values = { email };

  if (!email || !password) {
    return fail("Ingresa tu correo y contraseña", undefined, values);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail("Correo o contraseña incorrectos", undefined, values);

  redirect(safeNext(text(formData, "next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function callbackUrl(next: string): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}

const PROVIDERS = ["google", "github"] as const;

export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = PROVIDERS.find((p) => p === text(formData, "provider"));
  const next = safeNext(text(formData, "next"));
  if (!provider) redirect("/auth?error=oauth");

  const redirectTo = callbackUrl(next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error || !data.url) redirect("/auth?error=oauth");

  redirect(data.url);
}

export async function chooseUsername(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = normalizeUsername(text(formData, "username"));
  const values = { username };

  const invalid = usernameError(username);
  if (invalid) return fail(invalid, "username", values);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { error } = await supabase.rpc("set_username", {
    p_username: username,
  });
  if (error) {
    // 23505 = índice único de profiles.username (o el perfil ya existe).
    if (error.code === "23505") {
      return fail("Ese usuario ya existe", "username", values);
    }
    return fail(
      "No se pudo guardar el usuario. Inténtalo de nuevo",
      undefined,
      values,
    );
  }

  redirect(safeNext(text(formData, "next")));
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = text(formData, "email").trim();
  const values = { email };

  const invalid = emailError(email);
  if (invalid) return fail(invalid, "email", values);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/auth/nueva-clave"),
  });
  if (error) {
    return fail(
      "No se pudo enviar el correo. Inténtalo más tarde",
      undefined,
      values,
    );
  }

  // Misma respuesta exista o no la cuenta.
  return { done: true, values };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = text(formData, "password");
  const confirm = text(formData, "confirm");

  const invalid = passwordError(password);
  if (invalid) return fail(invalid, "password");
  if (password !== confirm)
    return fail("Las contraseñas no coinciden", "password");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/recuperar");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return fail("Usa una contraseña distinta a la anterior", "password");
    }
    if (error.code === "weak_password") {
      return fail("Contraseña demasiado débil", "password");
    }
    return fail("No se pudo cambiar la contraseña. Inténtalo de nuevo");
  }

  // Cierra las demás sesiones; si falla no bloquea el cambio de clave.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/");
}
