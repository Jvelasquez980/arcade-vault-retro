// Paletas de Tetris por skin. classic = colores originales del port, salvo
// etiquetas y texto de teclas aclarados lo mínimo para llegar a 4.5:1.
import type { SkinId } from "../types";

export type TetrisPalette = {
  bg: string; // tablero, panel y caja NEXT
  grid: string;
  /** Color por tipo de pieza (índice 1..8; 0 = vacío). */
  pieces: (string | null)[];
  /** Brillo superior del bloque (4 px). */
  highlight: string;
  ghostAlpha: number;
  label: string; // SCORE / LINES / LEVEL / NEXT / CONTROLS
  value: string; // números del panel
  boxBorder: string; // borde de la caja NEXT
  keyBg: string;
  keyBorder: string;
  keyText: string;
  /** Familia de fuente de etiquetas y teclas. */
  font: string;
  glow: number; // shadowBlur (0 = sin glow)
  /** Retro: sin suavizado, píxel de brillo en esquina en vez de franja. */
  hard: boolean;
  /** Color de scanlines (null = sin scanlines). */
  scanlines: string | null;
};

export const tetrisSkins: Record<SkinId, TetrisPalette> = {
  classic: {
    bg: "#1a1a25",
    grid: "#22222e",
    pieces: [
      null,
      "#4dd0e1", // I
      "#ffd54f", // O
      "#ba68c8", // T
      "#81c784", // S
      "#e57373", // Z
      "#90caf9", // J
      "#ffb74d", // L
      "#9e9e9e", // N (tuerca)
    ],
    highlight: "rgba(255,255,255,0.12)",
    ghostAlpha: 0.2,
    label: "#8585a3", // original #555570 (2.4:1)
    value: "#7aa2f7",
    boxBorder: "#2a2a3a",
    keyBg: "#22223a",
    keyBorder: "#3a3a5a",
    keyText: "#959595", // original #888 (4.36:1 sobre la tecla)
    font: "sans-serif",
    glow: 0,
    hard: false,
    scanlines: null,
  },
  neon: {
    bg: "#05050a",
    grid: "#141428",
    pieces: [
      null,
      "#00f5ff", // I
      "#f5ff00", // O
      "#ff006e", // T
      "#00ff88", // S
      "#ff3b3b", // Z
      "#5b8cff", // J
      "#ff9e00", // L
      "#c0c4e0", // N
    ],
    highlight: "rgba(255,255,255,0.35)",
    ghostAlpha: 0.25,
    label: "#ff4fa0",
    value: "#00f5ff",
    boxBorder: "#ff006e",
    keyBg: "#0d0d1c",
    keyBorder: "#00f5ff",
    keyText: "#e6e9ff",
    font: "sans-serif",
    glow: 10,
    hard: false,
    scanlines: null,
  },
  retro: {
    // Paleta NES limitada sobre negro.
    bg: "#000000",
    grid: "#1c1c1c",
    pieces: [
      null,
      "#3cbcfc", // I
      "#f8b800", // O
      "#d800cc", // T
      "#00a800", // S
      "#f83800", // Z
      "#6888fc", // J
      "#fca044", // L
      "#bcbcbc", // N
    ],
    highlight: "#fcfcfc",
    ghostAlpha: 0.3,
    label: "#f8b800",
    value: "#fcfcfc",
    boxBorder: "#fcfcfc",
    keyBg: "#000000",
    keyBorder: "#bcbcbc",
    keyText: "#fcfcfc",
    font: "monospace",
    glow: 0,
    hard: true,
    scanlines: "rgba(0, 0, 0, 0.35)",
  },
};
