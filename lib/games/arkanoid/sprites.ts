// Port de references/started-games/04-arkanoid/assets/spritesheet.js.
// Sin globals de módulo: la imagen se carga por instancia de motor.

import type { BlockColor } from "./levels";

export type Frame = { sx: number; sy: number; sw: number; sh: number };

const explosionRow = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

export const EXPLOSION_DURATION = 150;

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, Frame>,
};

export type SpriteName = "paddle" | "ball" | `block_${BlockColor}`;

/**
 * Carga el spritesheet (copiado a un canvas offscreen, como el original).
 * Devuelve una función de cancelación: tras cancelar, `onLoad` no se invoca.
 */
export function loadSpritesheet(
  src: string,
  onLoad: (sheet: HTMLCanvasElement) => void,
): () => void {
  let cancelled = false;
  const img = new Image();
  img.onload = () => {
    if (cancelled) return;
    const oc = document.createElement("canvas");
    oc.width = img.width;
    oc.height = img.height;
    oc.getContext("2d")?.drawImage(img, 0, 0);
    onLoad(oc);
  };
  img.onerror = () => {
    if (!cancelled) console.error("Failed to load spritesheet");
  };
  img.src = src;
  return () => {
    cancelled = true;
    img.onload = null;
    img.onerror = null;
  };
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Copia del spritesheet retocada para una skin (se hace UNA vez por instancia):
 * `filter` = ctx.filter al copiar; `quantize` = paleta limitada (vecino más
 * cercano en RGB; transparentes y casi negros se respetan). Sin cambios → el original.
 */
export function transformSheet(
  sheet: CanvasImageSource & { width: number; height: number },
  filter: string | null,
  quantize: string[] | null,
): CanvasImageSource {
  if (!filter && !quantize) return sheet;
  const oc = document.createElement("canvas");
  oc.width = sheet.width;
  oc.height = sheet.height;
  const c = oc.getContext("2d", { willReadFrequently: !!quantize });
  if (!c) return sheet;
  if (filter) c.filter = filter;
  c.drawImage(sheet, 0, 0);
  c.filter = "none";
  if (quantize) {
    const pal = quantize.map(hexToRgb);
    const img = c.getImageData(0, 0, oc.width, oc.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        d[i + 3] = 0; // alpha binario (bordes duros)
        continue;
      }
      d[i + 3] = 255;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r < 24 && g < 24 && b < 24) {
        d[i] = d[i + 1] = d[i + 2] = 0;
        continue;
      }
      let best = pal[0];
      let bestD = Infinity;
      for (const p of pal) {
        const dist = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
        if (dist < bestD) {
          bestD = dist;
          best = p;
        }
      }
      d[i] = best[0];
      d[i + 1] = best[1];
      d[i + 2] = best[2];
    }
    c.putImageData(img, 0, 0);
  }
  return oc;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const sp = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as BlockColor]
    : SPRITES[name as "paddle" | "ball"];
  if (!sp) return;
  drawFrame(ctx, sheet, sp, x, y, w, h);
}
