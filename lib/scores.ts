const KEY = "av_scores";

export type SavedScore = { game: string; score: number; name: string; at: number };

function readAll(): SavedScore[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScore(entry: Omit<SavedScore, "at">): void {
  try {
    const all = readAll();
    all.push({ ...entry, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function getBestScore(game: string, name: string): SavedScore | null {
  let best: SavedScore | null = null;
  for (const s of readAll()) {
    if (s.game === game && s.name === name && (!best || s.score > best.score)) {
      best = s;
    }
  }
  return best;
}
