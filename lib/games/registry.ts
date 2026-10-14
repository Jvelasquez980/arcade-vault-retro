// Registro de motores por id de juego (SPEC 07). Sin imports de servidor:
// lo usan Server Components (hasEngine) y el cliente (carga del def).
import type { GameEngineDef } from "./types";

export const ENGINES: Record<string, () => Promise<GameEngineDef>> = {
  asteroids: () => import("./asteroids/engine").then((m) => m.asteroidsDef),
  tetris: () => import("./tetris/engine").then((m) => m.tetrisDef),
  arkanoid: () => import("./arkanoid/engine").then((m) => m.arkanoidDef),
  snake: () => import("./snake/engine").then((m) => m.snakeDef),
};

export const hasEngine = (id: string) => id in ENGINES;
