export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "green" | "yellow";

export const CATS: ["TODOS", ...Category[]] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  color: Accent;
  cover: string;
  playersMin: number;
  playersMax: number;
  controls: ("keyboard" | "touch" | "gamepad")[];
  tags: string[];
  difficulty: number;
  plays: number; // game_stats.plays
  best: number; // game_stats.best
};

// 12400 → "12.4K", 0 → "0"
export function formatPlays(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
}

export function playersLabel(min: number, max: number): string {
  const n = min === max ? String(min) : `${min}–${max}`;
  return `${n} ${max === 1 ? "JUGADOR" : "JUGADORES"}`;
}

const CONTROL_LABELS = { keyboard: "TECLADO", touch: "TÁCTIL", gamepad: "MANDO" } as const;

export function controlsLabel(controls: Game["controls"]): string {
  return controls.map((c) => CONTROL_LABELS[c]).join(" / ");
}

// ISO → dd/mm/aaaa (UTC, determinista entre servidor y cliente)
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
