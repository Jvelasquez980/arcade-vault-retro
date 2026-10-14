// Paletas de Asteroids por skin. classic = colores originales del port (sin regresión).
import type { SkinId } from "../types";

export type AsteroidsPalette = {
  bg: string;
  ship: string;
  thrust: string;
  asteroid: string;
  bullet: string;
  /** "r,g,b"; el alpha lo pone el motor según la vida de la partícula. */
  particle: string;
  powerUp: string;
  hudText: string;
  hudAccent: string; // texto del triple disparo
  lifeIcon: string;
  lineWidth: number; // trazo de nave y asteroides
  glow: number; // shadowBlur (0 = sin glow)
  /** Retro: esquinas duras, balas cuadradas, alpha escalonado, sin suavizado. */
  hard: boolean;
  /** Color de scanlines (null = sin scanlines). */
  scanlines: string | null;
};

export const asteroidsSkins: Record<SkinId, AsteroidsPalette> = {
  classic: {
    bg: "#000",
    ship: "#fff",
    thrust: "rgba(255, 130, 0, 0.85)",
    asteroid: "#fff",
    bullet: "#fff",
    particle: "255,255,255",
    powerUp: "#0ff",
    hudText: "#fff",
    hudAccent: "#0ff",
    lifeIcon: "#fff",
    lineWidth: 1.5,
    glow: 0,
    hard: false,
    scanlines: null,
  },
  neon: {
    bg: "#05050a",
    ship: "#00f5ff",
    thrust: "#f5ff00",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    particle: "255,0,110",
    powerUp: "#00ff88",
    hudText: "#e6e9ff",
    hudAccent: "#00ff88",
    lifeIcon: "#00f5ff",
    lineWidth: 2,
    glow: 12,
    hard: false,
    scanlines: null,
  },
  retro: {
    bg: "#001200",
    ship: "#33ff33",
    thrust: "#ffb000",
    asteroid: "#33ff33",
    bullet: "#b6ffb6",
    particle: "51,255,51",
    powerUp: "#ffb000",
    hudText: "#33ff33",
    hudAccent: "#ffb000",
    lifeIcon: "#33ff33",
    lineWidth: 2,
    glow: 0,
    hard: true,
    scanlines: "rgba(0, 0, 0, 0.35)",
  },
};
