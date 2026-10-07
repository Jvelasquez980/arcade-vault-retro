// Contrato común de los motores de juego (SPEC 07).
// Patrón: createX(canvas, events) → GameController. Sin globals de módulo.

export type ExtraStat = {
  key: string;
  label: string;
  color?: "cyan" | "magenta" | "yellow" | "green";
  format?: "int" | "seconds"; // "seconds" = toFixed(1) + "s"
};

export type GameEvents = {
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  /** Stat extra; value null/0 oculta el stat. */
  onStat?: (key: string, value: number | null) => void;
};

export type GameController = {
  pause: () => void;
  resume: () => void;
  restart: () => void; // reinicia partida y reanuda
  destroy: () => void; // idempotente
};

export type GameEngineDef = {
  width: number; // tamaño lógico del canvas
  height: number;
  initialLives?: number; // si falta, no se muestra HUD de vidas
  showLevel?: boolean; // por defecto false
  stats?: ExtraStat[];
  create: (canvas: HTMLCanvasElement, events: GameEvents) => GameController;
};
