// Motor de Snake escrito desde cero (SPEC 10). Reglas clásicas: muro mortal,
// 1 vida, sin niveles. Sin globals de módulo: todo el estado vive en la instancia.

import type {
  GameController,
  GameEngineDef,
  GameEvents,
  SkinId,
} from "../types";
import { snakeSkins } from "./skins";
import { drawFruit, FRUIT_NAMES, FRUITS, loadFruits } from "./sprites";

const SIZE = 600;
const GRID = 20;
const CELL = SIZE / GRID;
const START_LEN = 3;
const FRUIT_POINTS = 10;
const BASE_TICK = 140;
const MIN_TICK = 70;
const TICK_STEP = 8;
const FRUITS_PER_STEP = 5;
const MAX_QUEUE = 2;
const MAX_DT = 50;

type Cell = { x: number; y: number };
type Dir = { x: number; y: number };

const DIRS: Record<string, Dir> = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function createSnake(
  canvas: HTMLCanvasElement,
  events: GameEvents,
  skin: SkinId = "classic",
): GameController {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // ── Skin (por instancia) ────────────────────────────────────────────────────
  const pal = snakeSkins[skin] ?? snakeSkins.classic;
  ctx.imageSmoothingEnabled = !pal.hard;
  let scanPattern: CanvasPattern | null = null;
  if (pal.scanlines) {
    // Patrón 1×3 (1 línea oscura cada 3 px): un solo fillRect por frame.
    const tile = document.createElement("canvas");
    tile.width = 1;
    tile.height = 3;
    const tc = tile.getContext("2d");
    if (tc) {
      tc.fillStyle = pal.scanlines;
      tc.fillRect(0, 2, 1, 1);
      scanPattern = ctx.createPattern(tile, "repeat");
    }
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  let body: Cell[] = [];
  let dir: Dir = { x: 1, y: 0 };
  let dirQueue: Dir[] = [];
  let fruit: { x: number; y: number; sprite: string } | null = null;
  let score = 0;
  let eaten = 0;
  let tickMs = BASE_TICK;
  let acc = 0;

  let img: HTMLImageElement | null = null;
  let paused = false;
  let finished = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId: number | null = null;

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function placeFruit(): boolean {
    const taken = new Set(body.map((c) => c.y * GRID + c.x));
    const free: number[] = [];
    for (let i = 0; i < GRID * GRID; i++) if (!taken.has(i)) free.push(i);
    if (free.length === 0) {
      fruit = null;
      return false;
    }
    const idx = free[Math.floor(Math.random() * free.length)];
    fruit = {
      x: idx % GRID,
      y: Math.floor(idx / GRID),
      sprite: FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)],
    };
    return true;
  }

  function initGame() {
    body = [];
    for (let i = 0; i < START_LEN; i++) body.push({ x: 10 - i, y: 10 });
    dir = { x: 1, y: 0 };
    dirQueue = [];
    score = 0;
    eaten = 0;
    tickMs = BASE_TICK;
    acc = 0;
    finished = false;
    lastTime = null;
    placeFruit();
    events.onScore(0);
    events.onLives?.(1);
    events.onStat?.("length", START_LEN);
  }

  function enqueueTurn(next: Dir) {
    if (dirQueue.length >= MAX_QUEUE) return;
    const ref = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (next.x === ref.x && next.y === ref.y) return;
    if (next.x === -ref.x && next.y === -ref.y) return;
    dirQueue.push(next);
  }

  function step() {
    const queued = dirQueue.shift();
    if (queued) dir = queued;

    const head = body[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;
    const grows = fruit !== null && fruit.x === nx && fruit.y === ny;

    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) return die();
    // La celda que deja la cola cuenta como libre salvo que se crezca.
    const limit = grows ? body.length : body.length - 1;
    for (let i = 0; i < limit; i++) {
      if (body[i].x === nx && body[i].y === ny) return die();
    }

    body.unshift({ x: nx, y: ny });
    if (!grows) {
      body.pop();
      return;
    }

    score += FRUIT_POINTS;
    eaten++;
    tickMs = Math.max(
      MIN_TICK,
      BASE_TICK - TICK_STEP * Math.floor(eaten / FRUITS_PER_STEP),
    );
    events.onScore(score);
    events.onStat?.("length", body.length);
    if (!placeFruit()) win();
  }

  function die() {
    finished = true;
    events.onLives?.(0);
  }

  function win() {
    finished = true;
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = pal.bg;
    c.fillRect(0, 0, SIZE, SIZE);

    c.strokeStyle = pal.grid;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < GRID; i++) {
      c.moveTo(i * CELL + 0.5, 0);
      c.lineTo(i * CELL + 0.5, SIZE);
      c.moveTo(0, i * CELL + 0.5);
      c.lineTo(SIZE, i * CELL + 0.5);
    }
    c.stroke();

    if (fruit && img) {
      drawFruit(c, img, FRUITS[fruit.sprite], fruit.x, fruit.y, CELL);
    }

    // Cuerpo en un solo path (un fill, un glow); la cabeza encima.
    if (pal.glow) {
      c.shadowColor = pal.body;
      c.shadowBlur = pal.glow;
    }
    c.fillStyle = pal.body;
    c.beginPath();
    for (let i = body.length - 1; i >= 1; i--) {
      c.rect(body[i].x * CELL + 1, body[i].y * CELL + 1, CELL - 2, CELL - 2);
    }
    c.fill();
    if (body.length) {
      if (pal.glow) c.shadowColor = pal.head;
      c.fillStyle = pal.head;
      c.fillRect(body[0].x * CELL + 1, body[0].y * CELL + 1, CELL - 2, CELL - 2);
    }
    c.shadowBlur = 0;

    if (scanPattern) {
      c.fillStyle = scanPattern;
      c.fillRect(0, 0, SIZE, SIZE);
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    rafId = null;
    if (destroyed || paused || !img) return;

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    acc += dt;
    while (acc >= tickMs && !finished) {
      acc -= tickMs;
      step();
    }
    draw(ctx!);

    if (finished) {
      // El motor se detiene; el último frame queda en el canvas.
      dirQueue = [];
      events.onGameOver(score);
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null || destroyed || !img) return;
    lastTime = null;
    acc = 0;
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

  function isActive() {
    return !destroyed && !paused && !finished && img !== null;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isFormTarget(e)) return;
    if (!isActive()) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const next = DIRS[key];
    if (!next) return;
    if (ARROWS.includes(e.key)) e.preventDefault();
    enqueueTurn(next);
  }

  function onBlur() {
    dirQueue = [];
    lastTime = null;
    acc = 0;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);

  // ── Arranque (tras cargar fruits.png) ───────────────────────────────────────
  const cancelLoad = loadFruits("/games/snake/fruits.png", (loaded) => {
    if (destroyed) return;
    img = loaded;
    initGame();
    draw(ctx);
    if (!paused) startLoop();
  });

  return {
    pause() {
      if (destroyed || paused || finished) return;
      paused = true;
      stopLoop();
      dirQueue = [];
    },
    resume() {
      if (destroyed || !paused || finished) return;
      paused = false;
      startLoop();
    },
    restart() {
      if (destroyed || !img) return;
      stopLoop();
      paused = false;
      initGame();
      draw(ctx);
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelLoad();
      stopLoop();
      dirQueue = [];
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
  };
}

export const snakeDef: GameEngineDef = {
  width: SIZE,
  height: SIZE,
  initialLives: 1,
  stats: [{ key: "length", label: "LONGITUD", format: "int" }],
  create: createSnake,
};
