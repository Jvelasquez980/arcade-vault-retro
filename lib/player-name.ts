const KEY = "av_player_name";

export function getPlayerName(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function setPlayerName(name: string): void {
  try {
    window.localStorage.setItem(KEY, name);
  } catch {}
}
