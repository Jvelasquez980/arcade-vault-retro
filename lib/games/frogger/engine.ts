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
}

export interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
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
