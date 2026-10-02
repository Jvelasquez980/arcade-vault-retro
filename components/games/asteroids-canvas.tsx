"use client";

import { useEffect, useRef } from "react";
import {
  createAsteroids,
  type AsteroidsController,
  type AsteroidsEvents,
} from "@/lib/games/asteroids/engine";

type Props = {
  events: AsteroidsEvents;
  onReady: (controller: AsteroidsController | null) => void;
};

export function AsteroidsCanvas({ events, onReady }: Props) {
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
    const controller = createAsteroids(canvas, {
      onScore: (v) => eventsRef.current.onScore(v),
      onLives: (v) => eventsRef.current.onLives(v),
      onLevel: (v) => eventsRef.current.onLevel(v),
      onTriple: (v) => eventsRef.current.onTriple(v),
      onGameOver: (v) => eventsRef.current.onGameOver(v),
    });
    const notify = onReadyRef.current;
    notify(controller);
    return () => {
      controller.destroy();
      notify(null);
    };
  }, []);

  return <canvas ref={canvasRef} className="asteroids-canvas" width={800} height={600} />;
}
