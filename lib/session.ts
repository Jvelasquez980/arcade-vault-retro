const KEY = "av_user";

export type User = { name: string };

export function getUser(): User | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.name === "string" ? { name: parsed.name } : null;
  } catch {
    return null;
  }
}

export function login(user: User): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ name: user.name }));
  } catch {}
}

export function logout(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
