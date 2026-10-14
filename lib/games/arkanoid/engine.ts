// Port a TS de references/started-games/04-arkanoid/game.js.
// Sin estado global de módulo: todo vive dentro de createArkanoid().

import type {
  GameController,
  GameEngineDef,
  GameEvents,
  SkinId,
} from "../types";
import { LEVELS, type BlockColor } from "./levels";
import { arkanoidSkins } from "./skins";
import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  drawFrame,
  drawSprite,
  loadSpritesheet,
  transformSheet,
} from "./sprites";

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const MAX_LEVEL = LEVELS.length;
const INITIAL_LIVES = 3;

const GAME_KEYS = ["ArrowLeft", "ArrowRight"];

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
};

export function createArkanoid(
  canvas: HTMLCanvasElement,
  events: GameEvents,
  skin: SkinId = "classic",
): GameController {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { pause() {}, resume() {}, restart() {}, destroy() {} };
  }

  // ── Skin (por instancia) ────────────────────────────────────────────────────
  const pal = arkanoidSkins[skin] ?? arkanoidSkins.classic;
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
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = INITIAL_LIVES;
  let score = 0;
  let currentLevel = 1;

  let sheet: CanvasImageSource | null = null;
  let paused = false;
  let finished = false;
  let destroyed = false;
  let rafId: number | null = null;
  let lastTime: number | null = null;

  // Últimos valores emitidos (eventos solo al cambiar).
  let emittedScore: number | null = null;
  let emittedLives: number | null = null;
  let emittedLevel: number | null = null;

  // ── Audio ───────────────────────────────────────────────────────────────────
  const bounceSound = new Audio("/games/arkanoid/ball-bounce.mp3");
  const breakSound = new Audio("/games/arkanoid/break-sound.mp3");
  const activeSounds = new Set<HTMLAudioElement>();

  function playSound(base: HTMLAudioElement) {
    if (destroyed || paused || finished) return;
    const a = base.cloneNode() as HTMLAudioElement;
    activeSounds.add(a);
    a.addEventListener("ended", () => activeSounds.delete(a), { once: true });
    a.play().catch(() => activeSounds.delete(a));
  }

  function stopSounds() {
    for (const a of activeSounds) a.pause();
    activeSounds.clear();
  }

  function emitState() {
    if (score !== emittedScore) {
      emittedScore = score;
      events.onScore(score);
    }
    if (lives !== emittedLives) {
      emittedLives = lives;
      events.onLives?.(lives);
    }
    if (currentLevel !== emittedLevel) {
      emittedLevel = currentLevel;
      events.onLevel?.(currentLevel);
    }
  }

  function clearKeys() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  }

  // ── Lógica ──────────────────────────────────────────────────────────────────
  function placeBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    placeBall();
  }

  function initGame() {
    score = 0;
    lives = INITIAL_LIVES;
    finished = false;
    paddle.x = (W - paddle.w) / 2;
    clearKeys();
    loadLevel(1);
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function update(dt: number) {
    // Paleta
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Bola
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes y techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Colisión con bloques (uno por frame)
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < MAX_LEVEL) loadLevel(currentLevel + 1);
          else finished = true; // victoria
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Bola perdida
    if (!finished && ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        finished = true;
      } else {
        placeBall();
      }
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function draw(c: CanvasRenderingContext2D, img: CanvasImageSource) {
    c.fillStyle = pal.bg;
    c.fillRect(0, 0, W, H);

    // Marco (paredes y techo; solo visual, no cambia colisiones)
    if (pal.frame) {
      const fw = pal.frameWidth;
      c.fillStyle = pal.frame;
      if (pal.glow) {
        c.shadowColor = pal.frame;
        c.shadowBlur = pal.glow;
      }
      c.fillRect(0, 0, W, fw);
      c.fillRect(0, 0, fw, H);
      c.fillRect(W - fw, 0, fw, H);
      c.shadowBlur = 0;
    }

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          c,
          img,
          `block_${block.color}`,
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }

    // Contornos por color: un path por color (≤7 trazos con glow por frame).
    if (pal.blockEdge) {
      const ew = pal.edgeWidth;
      c.lineWidth = ew;
      c.lineJoin = "miter";
      for (const color of Object.keys(pal.blockEdge) as BlockColor[]) {
        let any = false;
        c.beginPath();
        for (const b of blocks) {
          if (!b.alive || b.color !== color) continue;
          any = true;
          c.rect(b.x + ew / 2, b.y + ew / 2, b.w - ew, b.h - ew);
        }
        if (!any) continue;
        const edge = pal.blockEdge[color];
        c.strokeStyle = edge;
        if (pal.glow) {
          c.shadowColor = edge;
          c.shadowBlur = pal.glow;
        }
        c.stroke();
      }
      c.shadowBlur = 0;
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(
        c,
        img,
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    if (pal.glow) {
      c.shadowColor = pal.paddleGlow;
      c.shadowBlur = pal.glow;
    }
    drawSprite(c, img, "paddle", paddle.x, paddle.y, paddle.w, paddle.h);
    if (pal.glow) c.shadowColor = pal.ballGlow;
    drawSprite(c, img, "ball", ball.x, ball.y, ball.w, ball.h);
    c.shadowBlur = 0;

    // HUD nativo (solo mientras se juega, como en el original)
    if (!finished) {
      c.fillStyle = pal.hudText;
      c.font = "bold 18px monospace";
      c.textAlign = "left";
      c.textBaseline = "top";
      c.fillText(`Score: ${score}`, 10, 10);
      c.fillStyle = pal.hudLevel;
      c.textAlign = "center";
      c.fillText(`Nivel: ${currentLevel}`, W / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = W - 10 - (lives - i) * (ballSize + ballSpacing);
        drawSprite(c, img, "ball", bx, 10, ballSize, ballSize);
      }
    }

    if (scanPattern) {
      c.fillStyle = scanPattern;
      c.fillRect(0, 0, W, H);
    }
  }

  // ── Loop ────────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    rafId = null;
    if (destroyed || paused || !sheet) return;

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw(ctx!, sheet);
    emitState();

    if (finished) {
      // El motor se detiene; el último frame queda en el canvas.
      clearKeys();
      events.onGameOver(score);
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null || destroyed || !sheet) return;
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

  function isActive() {
    return !destroyed && !paused && !finished && sheet !== null;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isFormTarget(e)) return;
    if (!isActive()) return;
    if (!GAME_KEYS.includes(e.key)) return;
    e.preventDefault();
    keys[e.key] = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key in keys) keys[e.key] = false;
  }

  function onMouseMove(e: MouseEvent) {
    if (!isActive()) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(
      0,
      Math.min(canvas.width - paddle.w, mouseX - paddle.w / 2),
    );
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);
  canvas.addEventListener("mousemove", onMouseMove);

  // ── Arranque (tras cargar el spritesheet) ───────────────────────────────────
  const cancelLoad = loadSpritesheet(
    "/games/arkanoid/spritesheet-breakout.png",
    (img) => {
      if (destroyed) return;
      sheet = transformSheet(img, pal.sheetFilter, pal.quantize);
      initGame();
      emitState();
      if (!paused) startLoop();
    },
  );

  return {
    pause() {
      if (destroyed || paused || finished) return;
      paused = true;
      stopLoop();
      clearKeys();
      stopSounds();
    },
    resume() {
      if (destroyed || !paused || finished) return;
      paused = false;
      startLoop();
    },
    restart() {
      if (destroyed || !sheet) return;
      stopLoop();
      stopSounds();
      paused = false;
      initGame();
      emitState();
      startLoop();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelLoad();
      stopLoop();
      clearKeys();
      stopSounds();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}

export const arkanoidDef: GameEngineDef = {
  width: W,
  height: H,
  initialLives: 3,
  showLevel: true,
  touch: {
    dpad: {
      left: { key: "ArrowLeft", code: "ArrowLeft", label: "◀" },
      right: { key: "ArrowRight", code: "ArrowRight", label: "▶" },
    },
  },
  create: createArkanoid,
};
