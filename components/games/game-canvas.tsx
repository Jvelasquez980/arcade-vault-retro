"use client";

import { useEffect, useRef } from "react";
import type {
  GameController,
  GameEngineDef,
  GameEvents,
} from "@/lib/games/types";

type Props = {
  def: GameEngineDef;
  events: GameEvents;
  onReady: (controller: GameController | null) => void;
};

export function GameCanvas({ def, events, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eventsRef = useRef(events);
  const onReadyRef = useRef(onReady);

  // Los callbacks cambian en cada render; el motor se crea una sola vez y lee el último.
  useEffect(() => {
    eventsRef.current = events;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = def.create(canvas, {
      onScore: (v) => eventsRef.current.onScore(v),
      onGameOver: (v) => eventsRef.current.onGameOver(v),
      onLives: (v) => eventsRef.current.onLives?.(v),
      onLevel: (v) => eventsRef.current.onLevel?.(v),
      onStat: (k, v) => eventsRef.current.onStat?.(k, v),
    });
    const notify = onReadyRef.current;
    notify(controller);
    return () => {
      controller.destroy();
      notify(null);
    };
  }, [def]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={def.width}
      height={def.height}
    />
  );
}
