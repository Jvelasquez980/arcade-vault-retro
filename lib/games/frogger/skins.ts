// Paletas de Frogger por skin. classic = colores originales del motor (sin regresión).
import type { SkinId } from "../types";

export type FroggerPalette = {
  road: string;
  roadLine: string;
  river: string;
  safe: string;
  wall: string;
  mouth: string;
  mouthEdge: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleShell: string;
  turtleGhost: string;
  truck: string;
  truckCab: string;
  cars: string[];
  carGlass: string;
  wheel: string;
  frog: string;
  frogDark: string;
  eye: string;
  pupil: string;
  text: string;
  /** Barra de tiempo: >50 %, >25 %, resto. */
  timer: [string, string, string];
  glow: number; // shadowBlur (0 = sin glow)
  /** Retro: sin suavizado de imagen. */
  hard: boolean;
  /** Color de scanlines (null = sin scanlines). */
  scanlines: string | null;
};

export const froggerSkins: Record<SkinId, FroggerPalette> = {
  classic: {
    road: "#0a0a12",
    roadLine: "rgba(255,255,255,0.18)",
    river: "#0a2a5a",
    safe: "#0c3a1c",
    wall: "#06260f",
    mouth: "#2fd45a",
    mouthEdge: "#ffd400",
    log: "#a8682c", // original #7a4a1e: 1.89:1 sobre el río
    logLine: "#5a3412",
    turtle: "#1fae5a",
    turtleShell: "#128a40",
    turtleGhost: "rgba(31,174,90,0.28)",
    truck: "#9aa0a6",
    truckCab: "#d8dde2",
    cars: ["#e63946", "#ffd400", "#2d7bff"],
    carGlass: "rgba(10,10,18,0.55)",
    wheel: "#3a3a46", // original #111: invisible al asomar sobre la carretera
    frog: "#39ff14",
    frogDark: "#1fae0c",
    eye: "#fff",
    pupil: "#000",
    text: "#fff",
    timer: ["#39ff14", "#ffd400", "#ff2d2d"],
    glow: 0,
    hard: false,
    scanlines: null,
  },
  neon: {
    road: "#05050a",
    roadLine: "rgba(0,245,255,0.28)",
    river: "#03122e",
    safe: "#140520",
    wall: "#05050a",
    mouth: "#00804a",
    mouthEdge: "#00f5ff",
    log: "#ff006e",
    logLine: "#80003a",
    turtle: "#00ff88",
    turtleShell: "#00803f",
    turtleGhost: "rgba(0,255,136,0.22)",
    truck: "#00f5ff",
    truckCab: "#d9feff",
    cars: ["#ff006e", "#f5ff00", "#00f5ff"],
    carGlass: "rgba(5,5,10,0.6)",
    wheel: "#2a2a3a",
    frog: "#f5ff00",
    frogDark: "#a8b000",
    eye: "#fff",
    pupil: "#000",
    text: "#fff",
    timer: ["#00ff88", "#f5ff00", "#ff006e"],
    glow: 10,
    hard: false,
    scanlines: null,
  },
  retro: {
    road: "#000000",
    roadLine: "#7c7c7c",
    river: "#000080",
    safe: "#005800",
    wall: "#002800",
    mouth: "#00a800",
    mouthEdge: "#f8b800",
    log: "#c84c0c",
    logLine: "#503000",
    turtle: "#00b800",
    turtleShell: "#005800",
    turtleGhost: "rgba(0,184,0,0.3)",
    truck: "#bcbcbc",
    truckCab: "#fcfcfc",
    cars: ["#f83800", "#f8b800", "#3cbcfc"],
    carGlass: "#000000",
    wheel: "#7c7c7c",
    frog: "#b8f818",
    frogDark: "#58d854",
    eye: "#fcfcfc",
    pupil: "#000000",
    text: "#fcfcfc",
    timer: ["#58d854", "#f8b800", "#f83800"],
    glow: 0,
    hard: true,
    scanlines: "rgba(0, 0, 0, 0.3)",
  },
};
