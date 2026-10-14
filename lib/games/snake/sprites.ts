// Port de references/snake-assets/sprites.js (window.SPRITE_ATLAS.fruits).
// Sin globals de módulo: la imagen se carga por instancia de motor.

export type FruitSprite = { x: number; y: number; w: number; h: number };

export const FRUITS: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_NAMES = Object.keys(FRUITS);

/** Dibuja el recorte contenido en la celda, centrado y sin deformar. */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sprite: FruitSprite,
  cellX: number,
  cellY: number,
  cell: number,
) {
  const scale = Math.min(cell / sprite.w, cell / sprite.h);
  const dw = sprite.w * scale;
  const dh = sprite.h * scale;
  ctx.drawImage(
    img,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    cellX * cell + (cell - dw) / 2,
    cellY * cell + (cell - dh) / 2,
    dw,
    dh,
  );
}

/**
 * Carga fruits.png por instancia. Devuelve una función de cancelación:
 * tras cancelar, `onLoad` no se invoca.
 */
export function loadFruits(
  src: string,
  onLoad: (img: HTMLImageElement) => void,
): () => void {
  let cancelled = false;
  const img = new Image();
  img.onload = () => {
    if (!cancelled) onLoad(img);
  };
  img.onerror = () => {
    if (!cancelled) console.error("Failed to load fruits spritesheet");
  };
  img.src = src;
  return () => {
    cancelled = true;
  };
}
