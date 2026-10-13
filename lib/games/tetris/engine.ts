// Port a TS de references/templates/started-games/03-tetris/game.js.
// Sin estado global de módulo: todo vive dentro de createTetris().

import type {
  ExtraStat,
  GameController,
  GameEngineDef,
  GameEvents,
} from "../types";

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_W = COLS * BLOCK; // 300
const PANEL_X = BOARD_W + 20; // hueco de 20 px
const PANEL_W = 160;
const W = PANEL_X + PANEL_W; // 480
const H = ROWS * BLOCK; // 600

const BG = "#1a1a25";
const GRID_LINE = "#22222e";
const MAX_DT = 50; // ms de acumulación por frame

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I
  "#ffd54f", // O
  "#ba68c8", // T
  "#81c784", // S
  "#e57373", // Z
  "#90caf9", // J
  "#ffb74d", // L
  "#9e9e9e", // N (tuerca)
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  // [
  //   [8, 8, 8],
  //   [8, 0, 8],
  //   [8, 8, 8],
  // ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];

const CONTROLS: [string, string][] = [
  ["← →", "Mover"],
  ["↑", "Rotar"],
  ["↓", "Bajar"],
  ["Space", "Caída"],
  ["P", "Pausa"],
];

type Piece = { type: number; shape: number[][]; x: number; y: number };

const createBoard = () =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape: number[][]) {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS[colorIndex] as string;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  ctx.globalAlpha = 1;
}

export function createTetris(
  canvas: HTMLCanvasElement,
  events: GameEvents,
): GameController {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  let board = createBoard();
  let current = randomPiece();
  let next = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let lastTime: number | null = null;
  let rafId: number | null = null;
  let paused = false;
  let gameOver = false;
  let overNotified = false;
  let destroyed = false;

  // Último valor emitido: los eventos solo salen al cambiar.
  const sent = { score: -1, lives: -1, level: -1, lines: -1 };

  function emitState() {
    if (sent.score !== score) {
      sent.score = score;
      events.onScore(score);
    }
    const lives = gameOver ? 0 : 1;
    if (sent.lives !== lives) {
      sent.lives = lives;
      events.onLives?.(lives);
    }
    if (sent.level !== level) {
      sent.level = level;
      events.onLevel?.(level);
    }
    if (sent.lines !== lines) {
      sent.lines = lines;
      events.onStat?.("lines", lines);
    }
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) gameOver = true;
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    gameOver = false;
    overNotified = false;
    sent.score = sent.lives = sent.level = sent.lines = -1;
    next = randomPiece();
    spawn();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawGrid(c: CanvasRenderingContext2D) {
    c.strokeStyle = GRID_LINE;
    c.lineWidth = 0.5;
    for (let x = 1; x < COLS; x++) {
      c.beginPath();
      c.moveTo(x * BLOCK, 0);
      c.lineTo(x * BLOCK, H);
      c.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      c.beginPath();
      c.moveTo(0, y * BLOCK);
      c.lineTo(BOARD_W, y * BLOCK);
      c.stroke();
    }
  }

  function drawLabel(c: CanvasRenderingContext2D, text: string, y: number) {
    c.fillStyle = "#555570";
    c.font = "10px sans-serif";
    c.letterSpacing = "2px";
    c.textBaseline = "alphabetic";
    c.fillText(text, PANEL_X, y);
    c.letterSpacing = "0px";
  }

  function drawValue(c: CanvasRenderingContext2D, text: string, y: number) {
    c.fillStyle = "#7aa2f7";
    c.font = "bold 26px monospace";
    c.fillText(text, PANEL_X, y);
  }

  function drawPanel(c: CanvasRenderingContext2D) {
    drawLabel(c, "SCORE", 14);
    drawValue(c, score.toLocaleString(), 44);
    drawLabel(c, "LINES", 78);
    drawValue(c, String(lines), 108);
    drawLabel(c, "LEVEL", 142);
    drawValue(c, String(level), 172);

    drawLabel(c, "NEXT", 206);
    const boxX = PANEL_X;
    const boxY = 216;
    c.fillStyle = BG;
    c.fillRect(boxX, boxY, 120, 120);
    c.strokeStyle = "#2a2a3a";
    c.lineWidth = 1;
    c.strokeRect(boxX + 0.5, boxY + 0.5, 119, 119);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    c.save();
    c.translate(boxX, boxY);
    for (let r = 0; r < shape.length; r++)
      for (let k = 0; k < shape[r].length; k++)
        drawBlock(c, offX + k, offY + r, shape[r][k], BLOCK);
    c.restore();

    drawLabel(c, "CONTROLS", 366);
    c.font = "12px sans-serif";
    c.textBaseline = "middle";
    CONTROLS.forEach(([key, desc], i) => {
      const y = 388 + i * 26;
      const kw = Math.ceil(c.measureText(key).width) + 12;
      c.fillStyle = "#22223a";
      c.fillRect(PANEL_X, y - 10, kw, 20);
      c.strokeStyle = "#3a3a5a";
      c.lineWidth = 1;
      c.strokeRect(PANEL_X + 0.5, y - 9.5, kw - 1, 19);
      c.fillStyle = "#888";
      c.fillText(key, PANEL_X + 6, y);
      c.fillText(desc, PANEL_X + kw + 8, y);
    });
    c.textBaseline = "alphabetic";
  }

  function draw(c: CanvasRenderingContext2D) {
    c.fillStyle = BG;
    c.fillRect(0, 0, W, H);
    drawGrid(c);

    for (let r = 0; r < ROWS; r++)
      for (let k = 0; k < COLS; k++) drawBlock(c, k, r, board[r][k], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let k = 0; k < current.shape[r].length; k++)
        if (current.shape[r][k])
          drawBlock(c, current.x + k, gy + r, current.shape[r][k], BLOCK, 0.2);

    for (let r = 0; r < current.shape.length; r++)
      for (let k = 0; k < current.shape[r].length; k++)
        drawBlock(c, current.x + k, current.y + r, current.shape[r][k], BLOCK);

    drawPanel(c);
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  // Emite estado, dibuja y, si la partida terminó, notifica una sola vez.
  function settle() {
    emitState();
    draw(ctx!);
    if (gameOver && !overNotified) {
      overNotified = true;
      events.onGameOver(score);
    }
  }

  function loop(ts: number) {
    rafId = null;
    if (destroyed || paused || gameOver) return;

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }

    settle();
    if (gameOver) return; // el último frame queda en el canvas
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null || destroyed || gameOver) return;
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
    if (isFormTarget(e)) return;
    if (paused || destroyed || gameOver) return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    settle();
    if (gameOver) stopLoop();
  }

  function onBlur() {
    lastTime = null;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);

  // ── Arranque ────────────────────────────────────────────────────────────────
  initGame();
  settle();
  startLoop();

  return {
    pause() {
      if (destroyed || paused || gameOver) return;
      paused = true;
      stopLoop();
    },
    resume() {
      if (destroyed || !paused || gameOver) return;
      paused = false;
      startLoop();
    },
    restart() {
      if (destroyed) return;
      stopLoop();
      paused = false;
      initGame();
      settle();
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    },
  };
}

const TETRIS_STATS: ExtraStat[] = [
  { key: "lines", label: "LÍNEAS", format: "int" },
];

export const tetrisDef: GameEngineDef = {
  width: W,
  height: H,
  initialLives: 1,
  showLevel: true,
  stats: TETRIS_STATS,
  create: createTetris,
};
