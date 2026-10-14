// Paletas de Snake por skin. classic = colores originales del motor (sin regresión).
import type { SkinId } from "../types";

export type SnakePalette = {
  bg: string;
  grid: string;
  head: string;
  body: string;
  glow: number; // shadowBlur (0 = sin glow)
  /** Retro: sin suavizado de imagen. */
  hard: boolean;
  /** Color de scanlines (null = sin scanlines). */
  scanlines: string | null;
};

export const snakeSkins: Record<SkinId, SnakePalette> = {
  classic: {
    bg: "#000",
    grid: "rgba(255,255,255,0.05)",
    head: "#39ff14",
    body: "#1fae0c",
    glow: 0,
    hard: false,
    scanlines: null,
  },
  neon: {
    bg: "#05050a",
    grid: "rgba(0,245,255,0.08)",
    head: "#f5ff00",
    body: "#00ff88",
    glow: 12,
    hard: false,
    scanlines: null,
  },
  retro: {
    bg: "#001200",
    grid: "rgba(51,255,51,0.10)",
    head: "#ffb000",
    body: "#33ff33",
    glow: 0,
    hard: true,
    scanlines: "rgba(0, 0, 0, 0.35)",
  },
};
