// Motor de Frogger escrito desde cero (SPEC game-jam/frogger/02). Primitivas
// canvas, sin sprites. Sin globals de módulo: el estado vive en la instancia.

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const CANVAS_W = COLS * CELL; // 640
export const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

export const JUMP_MS = 120;

export type Direction = "up" | "down" | "left" | "right";

export type EntityType = "car" | "truck" | "log" | "turtle";

export interface Entity {
  col: number;
  width: number;
  type: EntityType;
  submerged?: boolean;
  /** Tortugas: ms dentro del ciclo de inmersión (independiente por grupo). */
  phase?: number;
}

export interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  /** Longitud del bucle en celdas (suma de ancho+hueco): conserva los huecos al reintroducir. */
  loop: number;
  entities: Entity[];
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

export const TURTLE_VISIBLE_MS = 3000;
export const TURTLE_SUBMERGED_MS = 1500;
export const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

const SPEED_PER_LEVEL = 1.15;

// Definición estática de carriles. speed en px/frame (60 fps) base del nivel 1.
// loop = count * (width + gap) debe ser >= COLS + width para que el bucle
// cubra la pantalla sin saltos visibles.
type LaneDef = {
  row: number;
  type: EntityType;
  width: number;
  gap: number;
  count: number;
  speed: number;
  dir: 1 | -1;
  offset: number; // desplazamiento inicial en celdas
};

const LANE_DEFS: LaneDef[] = [
  // Carretera (filas 8–12)
  { row: 8, type: "truck", width: 3, gap: 5, count: 3, speed: 1.5, dir: -1, offset: 2 },
  { row: 9, type: "car", width: 1, gap: 4, count: 4, speed: 2.5, dir: 1, offset: 0 },
  { row: 10, type: "car", width: 2, gap: 4, count: 3, speed: 2, dir: -1, offset: 5 },
  { row: 11, type: "truck", width: 3, gap: 6, count: 3, speed: 3, dir: 1, offset: 3 },
  { row: 12, type: "car", width: 1, gap: 5, count: 3, speed: 4, dir: -1, offset: 1 },
  // Río (filas 1–6)
  { row: 1, type: "log", width: 3, gap: 4, count: 3, speed: 1.2, dir: 1, offset: 1 },
  { row: 2, type: "turtle", width: 2, gap: 3, count: 4, speed: 1.5, dir: -1, offset: 0 },
  { row: 3, type: "log", width: 4, gap: 4, count: 3, speed: 2.5, dir: 1, offset: 6 },
  { row: 4, type: "log", width: 2, gap: 3, count: 4, speed: 1, dir: 1, offset: 2 },
  { row: 5, type: "turtle", width: 3, gap: 3, count: 4, speed: 1.8, dir: -1, offset: 4 },
  { row: 6, type: "log", width: 3, gap: 4, count: 3, speed: 3, dir: -1, offset: 0 },
];

export function buildLanes(level: number): Lane[] {
  const mult = Math.pow(SPEED_PER_LEVEL, Math.max(0, level - 1));
  return LANE_DEFS.map((d) => {
    const step = d.width + d.gap;
    const entities: Entity[] = [];
    for (let i = 0; i < d.count; i++) {
      const e: Entity = { col: d.offset + i * step, width: d.width, type: d.type };
      if (d.type === "turtle") {
        e.phase = Math.random() * TURTLE_CYCLE_MS;
        e.submerged = e.phase >= TURTLE_VISIBLE_MS;
      }
      entities.push(e);
    }
    return {
      row: d.row,
      speed: d.speed * mult,
      dir: d.dir,
      loop: d.count * step,
      entities,
    };
  });
}
