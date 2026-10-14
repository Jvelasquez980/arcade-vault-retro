// Paletas de Arkanoid por skin. classic = colores originales del port (sin regresión).
// Los sprites se conservan; la skin cambia fondo, HUD, marco, contornos de bloques,
// glow y un retoque único del spritesheet (filtro/cuantización) al cargarlo.
import type { SkinId } from "../types";
import type { BlockColor } from "./levels";

export type ArkanoidPalette = {
  bg: string;
  hudText: string; // "Score"
  hudLevel: string; // "Nivel"
  /** Marco del área de juego (paredes/techo); null = sin marco. */
  frame: string | null;
  frameWidth: number;
  /** Contorno por color de bloque; null = sin contorno (sprite tal cual). */
  blockEdge: Record<BlockColor, string> | null;
  edgeWidth: number;
  glow: number; // shadowBlur (0 = sin glow)
  paddleGlow: string;
  ballGlow: string;
  /** ctx.filter aplicado UNA vez al copiar el spritesheet (null = ninguno). */
  sheetFilter: string | null;
  /** Paleta limitada a la que se cuantiza el spritesheet (null = sin cuantizar). */
  quantize: string[] | null;
  /** Retro: sin suavizado de imagen. */
  hard: boolean;
  /** Color de scanlines (null = sin scanlines). */
  scanlines: string | null;
};

export const arkanoidSkins: Record<SkinId, ArkanoidPalette> = {
  classic: {
    bg: "#000",
    hudText: "#fff",
    hudLevel: "#fff",
    frame: null,
    frameWidth: 0,
    blockEdge: null,
    edgeWidth: 0,
    glow: 0,
    paddleGlow: "#fff",
    ballGlow: "#fff",
    sheetFilter: null,
    quantize: null,
    hard: false,
    scanlines: null,
  },
  neon: {
    bg: "#05050a",
    hudText: "#e6e9ff",
    hudLevel: "#00f5ff",
    frame: "#ff006e",
    frameWidth: 2,
    blockEdge: {
      red: "#ff3b6b",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#b45cff",
      hotpink: "#ff9a1f",
      green: "#4da8ff",
      gray: "#c8cbe6",
    },
    edgeWidth: 2,
    glow: 12,
    paddleGlow: "#00f5ff",
    ballGlow: "#f5ff00",
    sheetFilter: "saturate(1.6) brightness(1.2)",
    quantize: null,
    hard: false,
    scanlines: null,
  },
  retro: {
    bg: "#000000",
    hudText: "#f8b800",
    hudLevel: "#fcfcfc",
    frame: "#7c7c7c",
    frameWidth: 4,
    blockEdge: {
      red: "#f83800",
      yellow: "#f8b800",
      cyan: "#00e8d8",
      magenta: "#9878f8",
      hotpink: "#fca044",
      green: "#3cbcfc",
      gray: "#bcbcbc",
    },
    edgeWidth: 2,
    glow: 0,
    paddleGlow: "#fff",
    ballGlow: "#fff",
    sheetFilter: null,
    // Subconjunto de la paleta NES (sin negro: los píxeles negros se respetan aparte).
    quantize: [
      "#fcfcfc",
      "#bcbcbc",
      "#7c7c7c",
      "#545454",
      "#f83800",
      "#a81000",
      "#fca044",
      "#f8b800",
      "#d8b830",
      "#00b800",
      "#58d854",
      "#0058f8",
      "#3cbcfc",
      "#6844fc",
      "#9878f8",
      "#d800cc",
      "#e40058",
      "#00e8d8",
      "#008888",
    ],
    hard: true,
    scanlines: "rgba(0, 0, 0, 0.35)",
  },
};
