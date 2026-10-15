export const AUTH_LIMITS = {
  usernameMin: 3,
  usernameMax: 10,
  passwordMin: 8,
  email: 254,
} as const;

const USERNAME_RE = /^[A-Z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

// Devuelve el mensaje de error o null si es válido. Espera el valor ya normalizado.
export function usernameError(username: string): string | null {
  if (
    username.length < AUTH_LIMITS.usernameMin ||
    username.length > AUTH_LIMITS.usernameMax
  ) {
    return `El usuario debe tener entre ${AUTH_LIMITS.usernameMin} y ${AUTH_LIMITS.usernameMax} caracteres`;
  }
  if (!USERNAME_RE.test(username)) {
    return "Solo letras, números y guion bajo";
  }
  return null;
}

export function emailError(email: string): string | null {
  if (
    email.length === 0 ||
    email.length > AUTH_LIMITS.email ||
    !EMAIL_RE.test(email)
  ) {
    return "Correo inválido";
  }
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < AUTH_LIMITS.passwordMin) {
    return `La contraseña debe tener al menos ${AUTH_LIMITS.passwordMin} caracteres`;
  }
  return null;
}

export function validateSignUp(i: {
  username: unknown;
  email: unknown;
  password: unknown;
}):
  | { ok: true; value: { username: string; email: string; password: string } }
  | { ok: false; error: string } {
  const username = normalizeUsername(
    typeof i.username === "string" ? i.username : "",
  );
  const email = (typeof i.email === "string" ? i.email : "").trim();
  const password = typeof i.password === "string" ? i.password : "";

  const error =
    usernameError(username) ?? emailError(email) ?? passwordError(password);
  if (error) return { ok: false, error };
  return { ok: true, value: { username, email, password } };
}

// Solo rutas relativas internas; cualquier otra cosa cae en "/".
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return "/";
  return raw;
}

export type AuthField = "username" | "email" | "password";

// Estado de los formularios de auth (useActionState). Sin la contraseña.
export type AuthState = {
  error?: string;
  field?: AuthField;
  done?: boolean;
  values?: { username?: string; email?: string };
};
