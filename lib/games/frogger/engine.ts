// Motor de Frogger escrito desde cero (SPEC game-jam/frogger/02). Primitivas
// canvas, sin sprites. Sin globals de módulo: el estado vive en la instancia.

import type {
  GameController,
  GameEngineDef,
  GameEvents,
  SkinId,
} from "../types";
import { froggerSkins } from "./skins";

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
  {
    row: 8,
    type: "truck",
    width: 3,
    gap: 5,
    count: 3,
    speed: 1.5,
    dir: -1,
    offset: 2,
  },
  {
    row: 9,
    type: "car",
    width: 1,
    gap: 4,
    count: 4,
    speed: 2.5,
    dir: 1,
    offset: 0,
  },
  {
    row: 10,
    type: "car",
    width: 2,
    gap: 4,
    count: 3,
    speed: 2,
    dir: -1,
    offset: 5,
  },
  {
    row: 11,
    type: "truck",
    width: 3,
    gap: 6,
    count: 3,
    speed: 3,
    dir: 1,
    offset: 3,
  },
  {
    row: 12,
    type: "car",
    width: 1,
    gap: 5,
    count: 3,
    speed: 4,
    dir: -1,
    offset: 1,
  },
  // Río (filas 1–6)
  {
    row: 1,
    type: "log",
    width: 3,
    gap: 4,
    count: 3,
    speed: 1.2,
    dir: 1,
    offset: 1,
  },
  {
    row: 2,
    type: "turtle",
    width: 2,
    gap: 3,
    count: 4,
    speed: 1.5,
    dir: -1,
    offset: 0,
  },
  {
    row: 3,
    type: "log",
    width: 4,
    gap: 4,
    count: 3,
    speed: 2.5,
    dir: 1,
    offset: 6,
  },
  {
    row: 4,
    type: "log",
    width: 2,
    gap: 3,
    count: 4,
    speed: 1,
    dir: 1,
    offset: 2,
  },
  {
    row: 5,
    type: "turtle",
    width: 3,
    gap: 3,
    count: 4,
    speed: 1.8,
    dir: -1,
    offset: 4,
  },
  {
    row: 6,
    type: "log",
    width: 3,
    gap: 4,
    count: 3,
    speed: 3,
    dir: -1,
    offset: 0,
  },
];

export function buildLanes(level: number): Lane[] {
  const mult = Math.pow(SPEED_PER_LEVEL, Math.max(0, level - 1));
  return LANE_DEFS.map((d) => {
    const step = d.width + d.gap;
    const entities: Entity[] = [];
    for (let i = 0; i < d.count; i++) {
      const e: Entity = {
        col: d.offset + i * step,
        width: d.width,
        type: d.type,
      };
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

const START_COL = Math.floor(COLS / 2);
const BASE_TIME_S = 15;
const MIN_TIME_S = 8;
const MAX_DT = 50;
const START_LIVES = 3;
const STEP_POINTS = 10;
const GOAL_POINTS = 50;
const TIME_BONUS = 10;
const ROUND_POINTS = 200;

// Bocas destino: 5 bocas de 2 columnas (cols 1-2, 4-5, 7-8, 10-11, 13-14).
const MOUTH_COUNT = 5;
const mouthStartCol = (i: number) => 1 + i * 3;

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  w: "up",
  ArrowDown: "down",
  s: "down",
  ArrowLeft: "left",
  a: "left",
  ArrowRight: "right",
  d: "right",
};

const DIR_DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

const isRiverRow = (row: number) =>
  row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;

export function createFrogger(
  canvas: HTMLCanvasElement,
  events: GameEvents,
  skin: SkinId = "classic",
): GameController {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // ── Skin (por instancia) ────────────────────────────────────────────────────
  const C = froggerSkins[skin] ?? froggerSkins.classic;
  ctx.imageSmoothingEnabled = !C.hard;
  let scanPattern: CanvasPattern | null = null;
  if (C.scanlines) {
    // Patrón 1×3 (1 línea oscura cada 3 px): un solo fillRect por frame.
    const tile = document.createElement("canvas");
    tile.width = 1;
    tile.height = 3;
    const tc = tile.getContext("2d");
    if (tc) {
      tc.fillStyle = C.scanlines;
      tc.fillRect(0, 2, 1, 1);
      scanPattern = ctx.createPattern(tile, "repeat");
    }
  }
  /** Activa glow (neón) con el color dado; noGlow() lo restaura. */
  const glow = (c: CanvasRenderingContext2D, color: string) => {
    if (!C.glow) return;
    c.shadowColor = color;
    c.shadowBlur = C.glow;
  };
  const noGlow = (c: CanvasRenderingContext2D) => {
    if (C.glow) c.shadowBlur = 0;
  };

  // ── Estado ──────────────────────────────────────────────────────────────────
  let lanes: Lane[] = [];
  let frog: Frog = newFrog();
  let pendingDir: Direction | null = null;
  const goals: boolean[] = new Array(MOUTH_COUNT).fill(false);
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let timeLeft = BASE_TIME_S;
  let bestRow = ROW_START; // fila más alta alcanzada en la ronda

  let emittedScore = -1;
  let emittedLives = -1;
  let emittedLevel = -1;

  let paused = false;
  let finished = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  function newFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: START_COL,
      targetRow: ROW_START,
    };
  }

  const roundTime = () => Math.max(MIN_TIME_S, BASE_TIME_S - (level - 1));

  function emit() {
    if (score !== emittedScore) events.onScore((emittedScore = score));
    if (lives !== emittedLives) events.onLives?.((emittedLives = lives));
    if (level !== emittedLevel) events.onLevel?.((emittedLevel = level));
  }

  function initGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    goals.fill(false);
    lanes = buildLanes(level);
    frog = newFrog();
    pendingDir = null;
    timeLeft = roundTime();
    bestRow = ROW_START;
    finished = false;
    lastTime = null;
    emittedScore = emittedLives = emittedLevel = -1;
    emit();
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  /** Entidad de río que sostiene a la rana (por su centro), o null. */
  function getSupport(): Entity | null {
    const centre = frog.col + 0.5;
    for (const lane of lanes) {
      if (lane.row !== frog.row || !isRiverRow(lane.row)) continue;
      for (const e of lane.entities) {
        if (e.type === "turtle" && e.submerged) continue;
        if (centre >= e.col && centre < e.col + e.width) return e;
      }
    }
    return null;
  }

  /** Celda efectiva de la rana: a mitad del salto cuenta ya la de destino. */
  function effectivePos() {
    if (frog.animating && frog.animT >= JUMP_MS / 2) {
      return { col: frog.targetCol, row: frog.targetRow };
    }
    return { col: frog.col, row: frog.row };
  }

  /** true si un vehículo solapa a la rana (caja de 0.7 celdas, centrada). */
  function checkRoadCollision(): boolean {
    const pos = effectivePos();
    if (pos.row < ROW_ROAD_TOP || pos.row > ROW_ROAD_BOT) return false;
    const lo = pos.col + 0.15;
    const hi = pos.col + 0.85;
    for (const lane of lanes) {
      if (lane.row !== pos.row) continue;
      for (const e of lane.entities) {
        if (hi > e.col && lo < e.col + e.width) return true;
      }
    }
    return false;
  }

  /** Índice de la boca que cubre la columna, o -1. */
  function mouthAt(col: number): number {
    for (let i = 0; i < MOUTH_COUNT; i++) {
      const start = mouthStartCol(i);
      if (col >= start && col < start + 2) return i;
    }
    return -1;
  }

  /** Resuelve la llegada a la fila de metas. true si la rana sobrevive. */
  function checkGoal(): boolean {
    const m = mouthAt(frog.col);
    if (m === -1 || goals[m]) return false;
    goals[m] = true;
    score += GOAL_POINTS + Math.floor(timeLeft) * TIME_BONUS;
    if (goals.every(Boolean)) completeRound();
    else respawn();
    return true;
  }

  function resolveLanding() {
    if (frog.row < bestRow) {
      score += (bestRow - frog.row) * STEP_POINTS;
      bestRow = frog.row;
    }
    if (frog.row === ROW_GOALS && !checkGoal()) killFrog();
  }

  function respawn() {
    frog = newFrog();
    pendingDir = null;
    timeLeft = roundTime();
  }

  function completeRound() {
    score += ROUND_POINTS;
    level++;
    goals.fill(false);
    lanes = buildLanes(level);
    bestRow = ROW_START;
    respawn(); // reinicia posición y temporizador (roundTime ya usa el nuevo nivel)
    // onLevel/onScore se emiten al final del update (emit).
  }

  function killFrog() {
    if (finished) return;
    lives--;
    emit(); // onLives(lives) antes de un posible onGameOver
    if (lives <= 0) {
      finished = true;
      events.onGameOver(score);
      return;
    }
    respawn();
  }

  function killAndEmit() {
    killFrog();
    emit();
  }

  function update(dt: number) {
    // Entidades: px/frame (60 fps) → celdas/ms.
    for (const lane of lanes) {
      const delta = (lane.speed / CELL) * lane.dir * (dt / 16);
      for (const e of lane.entities) {
        e.col += delta;
        if (lane.dir === 1 && e.col >= COLS) e.col -= lane.loop;
        else if (lane.dir === -1 && e.col + e.width <= 0) e.col += lane.loop;
        if (e.type === "turtle") {
          e.phase = ((e.phase ?? 0) + dt) % TURTLE_CYCLE_MS;
          e.submerged = e.phase >= TURTLE_VISIBLE_MS;
        }
      }
    }

    // Rana: arrastre por la entidad de apoyo (solo quieta, en el río).
    if (!frog.animating && isRiverRow(frog.row)) {
      const support = getSupport();
      if (support) {
        const lane = lanes.find((l) => l.row === frog.row);
        if (lane) frog.col += (lane.speed / CELL) * lane.dir * (dt / 16);
      }
    }

    if (!frog.animating && pendingDir) {
      const { dc, dr } = DIR_DELTA[pendingDir];
      pendingDir = null;
      const baseCol = Math.round(frog.col);
      const tc = baseCol + dc;
      const tr = frog.row + dr;
      if (tc >= 0 && tc < COLS && tr >= 0 && tr < ROWS) {
        frog.animating = true;
        frog.animT = 0;
        frog.targetCol = tc;
        frog.targetRow = tr;
      }
    } else if (frog.animating) {
      frog.animT += dt;
      if (frog.animT >= JUMP_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        resolveLanding();
      }
    }

    // Muertes: vehículo, agua/sin apoyo, bordes del río, tiempo.
    if (checkRoadCollision()) return killAndEmit();
    if (!frog.animating && isRiverRow(frog.row)) {
      const centre = frog.col + 0.5;
      if (!getSupport() || centre < 0 || centre > COLS) return killAndEmit();
    }
    timeLeft -= dt / 1000;
    if (timeLeft <= 0) return killAndEmit();

    emit();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawEntity(
    c: CanvasRenderingContext2D,
    lane: Lane,
    e: Entity,
    idx: number,
  ) {
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;
    switch (e.type) {
      case "car": {
        // Vista cenital: ruedas asomando arriba/abajo, carrocería encima y
        // parabrisas hacia el sentido de avance.
        const color = C.cars[(lane.row + idx) % C.cars.length];
        const bx = x + 3;
        const bw = w - 6;
        c.fillStyle = C.wheel;
        for (const wx of [bx + 4, bx + bw - 12]) {
          c.fillRect(wx, y + 7, 8, 4);
          c.fillRect(wx, y + CELL - 11, 8, 4);
        }
        glow(c, color);
        c.fillStyle = color;
        c.fillRect(bx, y + 10, bw, CELL - 20);
        noGlow(c);
        c.fillStyle = C.carGlass;
        const front = lane.dir === 1 ? bx + bw - 13 : bx + 7;
        const rear = lane.dir === 1 ? bx + 5 : bx + bw - 9;
        c.fillRect(front, y + 13, 6, CELL - 26);
        c.fillRect(rear, y + 14, 4, CELL - 28);
        break;
      }
      case "truck": {
        const cabW = CELL - 4;
        c.fillStyle = C.wheel;
        for (const wx of [x + 10, x + w / 2 - 4, x + w - 18]) {
          c.fillRect(wx, y + 3, 8, 4);
          c.fillRect(wx, y + CELL - 7, 8, 4);
        }
        glow(c, C.truck);
        c.fillStyle = C.truck;
        c.fillRect(x + 2, y + 6, w - 4, CELL - 12);
        noGlow(c);
        c.fillStyle = C.truckCab;
        // Cabina en el lado hacia el que avanza.
        const cabX = lane.dir === 1 ? x + w - 2 - cabW : x + 2;
        c.fillRect(cabX, y + 6, cabW, CELL - 12);
        c.fillStyle = C.carGlass;
        c.fillRect(
          lane.dir === 1 ? cabX + cabW - 10 : cabX + 4,
          y + 10,
          6,
          CELL - 20,
        );
        break;
      }
      case "log": {
        glow(c, C.log);
        c.fillStyle = C.log;
        c.fillRect(x + 1, y + 6, w - 2, CELL - 12);
        noGlow(c);
        c.strokeStyle = C.logLine;
        c.lineWidth = 2;
        c.beginPath();
        for (let lx = x + 14; lx < x + w - 8; lx += 22) {
          c.moveTo(lx, y + 9);
          c.lineTo(lx, y + CELL - 9);
        }
        c.stroke();
        break;
      }
      case "turtle": {
        for (let i = 0; i < e.width; i++) {
          const cx = x + i * CELL + CELL / 2;
          const cy = y + CELL / 2;
          if (e.submerged) {
            c.fillStyle = C.turtleGhost;
            c.beginPath();
            c.arc(cx, cy, 14, 0, Math.PI * 2);
            c.fill();
          } else {
            glow(c, C.turtle);
            c.fillStyle = C.turtle;
            c.beginPath();
            c.arc(cx, cy, 15, 0, Math.PI * 2);
            c.fill();
            noGlow(c);
            c.strokeStyle = C.turtleShell;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(cx, cy, 8, 0, Math.PI * 2);
            c.moveTo(cx - 15, cy);
            c.lineTo(cx + 15, cy);
            c.moveTo(cx, cy - 15);
            c.lineTo(cx, cy + 15);
            c.stroke();
          }
        }
        break;
      }
    }
  }

  function drawFrog(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    jumping: boolean,
  ) {
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    c.fillStyle = C.frogDark;
    // Patas: recogidas en reposo, extendidas durante el salto.
    const reach = jumping ? 18 : 12;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        c.beginPath();
        c.ellipse(cx + sx * reach, cy + sy * 9, 5, 4, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    glow(c, C.frog);
    c.fillStyle = C.frog;
    c.beginPath();
    c.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
    c.fill();
    noGlow(c);
    c.fillStyle = C.eye;
    c.beginPath();
    c.arc(cx - 6, cy - 9, 4, 0, Math.PI * 2);
    c.arc(cx + 6, cy - 9, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = C.pupil;
    c.beginPath();
    c.arc(cx - 6, cy - 9, 2, 0, Math.PI * 2);
    c.arc(cx + 6, cy - 9, 2, 0, Math.PI * 2);
    c.fill();
  }

  function draw(c: CanvasRenderingContext2D) {
    // Zonas
    c.fillStyle = C.wall;
    c.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    c.fillStyle = C.river;
    c.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    c.fillStyle = C.safe;
    c.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
    c.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
    c.fillStyle = C.road;
    c.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );
    c.strokeStyle = C.roadLine;
    c.lineWidth = 2;
    c.setLineDash([16, 16]);
    c.beginPath();
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      c.moveTo(0, r * CELL);
      c.lineTo(CANVAS_W, r * CELL);
    }
    c.stroke();
    c.setLineDash([]);

    // Bocas destino (en la mitad inferior de la fila 0; arriba va el HUD)
    for (let i = 0; i < MOUTH_COUNT; i++) {
      const x = mouthStartCol(i) * CELL;
      c.fillStyle = C.mouth;
      c.fillRect(x + 2, 20, 2 * CELL - 4, CELL - 20);
      glow(c, C.mouthEdge);
      c.strokeStyle = C.mouthEdge;
      c.lineWidth = 2;
      c.strokeRect(x + 2, 20, 2 * CELL - 4, CELL - 20);
      noGlow(c);
      if (goals[i]) drawFrog(c, x + CELL / 2, -2, false);
    }

    // Entidades
    for (const lane of lanes) {
      lane.entities.forEach((e, i) => drawEntity(c, lane, e, i));
    }

    // Rana (interpolada durante el salto)
    let fx = frog.col * CELL;
    let fy = frog.row * CELL;
    if (frog.animating) {
      const t = Math.min(1, frog.animT / JUMP_MS);
      fx += (frog.targetCol * CELL - fx) * t;
      fy += (frog.targetRow * CELL - fy) * t;
    }
    drawFrog(c, fx, fy, frog.animating);

    // HUD interno
    const ratio = Math.max(0, timeLeft / roundTime());
    c.fillStyle =
      ratio > 0.5 ? C.timer[0] : ratio > 0.25 ? C.timer[1] : C.timer[2];
    c.fillRect(0, 0, CANVAS_W * ratio, 4);
    c.fillStyle = C.text;
    c.font = "bold 14px monospace";
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillText(`SCORE ${score}`, 8, 6);
    c.textAlign = "center";
    c.fillText(`NIVEL ${level}`, CANVAS_W / 2, 6);
    c.fillStyle = C.frog;
    for (let i = 0; i < lives; i++) {
      c.beginPath();
      c.arc(CANVAS_W - 14 - i * 20, 13, 6, 0, Math.PI * 2);
      c.fill();
    }

    if (scanPattern) {
      c.fillStyle = scanPattern;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    rafId = null;
    if (destroyed) return;
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    if (!paused && !finished) update(dt);
    draw(ctx!);
    if (finished) return;
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null || destroyed) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  function isFormTarget(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT")
    );
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isFormTarget(e) || destroyed || paused || finished || e.repeat) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const d = KEY_DIRS[key];
    if (!d) return;
    if (e.key.startsWith("Arrow")) e.preventDefault();
    pendingDir = d;
  }

  function onBlur() {
    pendingDir = null;
    lastTime = null;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);

  // ── Arranque ────────────────────────────────────────────────────────────────
  initGame();
  draw(ctx);
  startLoop();

  return {
    pause() {
      if (destroyed || paused || finished) return;
      paused = true;
      pendingDir = null;
    },
    resume() {
      if (destroyed || !paused || finished) return;
      paused = false;
      lastTime = null;
      startLoop();
    },
    restart() {
      if (destroyed) return;
      stopLoop();
      paused = false;
      initGame();
      draw(ctx);
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      pendingDir = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
  };
}

export const froggerDef: GameEngineDef = {
  width: CANVAS_W,
  height: CANVAS_H,
  initialLives: START_LIVES,
  showLevel: true,
  // Un salto por toque: sin repeat (el motor además ignora e.repeat).
  touch: {
    dpad: {
      up: { key: "ArrowUp", code: "ArrowUp", label: "▲" },
      left: { key: "ArrowLeft", code: "ArrowLeft", label: "◀" },
      right: { key: "ArrowRight", code: "ArrowRight", label: "▶" },
      down: { key: "ArrowDown", code: "ArrowDown", label: "▼" },
    },
  },
  create: createFrogger,
};
