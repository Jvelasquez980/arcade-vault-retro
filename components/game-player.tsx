"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AsteroidsCanvas } from "@/components/games/asteroids-canvas";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/catalog-shared";
import type { AsteroidsController, AsteroidsEvents } from "@/lib/games/asteroids/engine";
import { getPlayerName, setPlayerName } from "@/lib/player-name";
import { submitScore } from "@/app/games/[id]/jugar/actions";

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [triple, setTriple] = useState(0);
  const controllerRef = useRef<AsteroidsController | null>(null);

  // El nombre sigue a la sesión (que se hidrata tras el primer render) hasta que se edita
  // o se precarga el recordado (av_player_name) al terminar la partida.
  const name = typedName ?? user?.name ?? "INVITADO";

  const openGameOver = () => {
    const stored = getPlayerName();
    if (stored) setTypedName((prev) => prev ?? stored);
    setOver(true);
  };

  const asteroidsEvents: AsteroidsEvents = {
    onScore: setScore,
    onLives: setLives,
    onLevel: setLevel,
    onTriple: setTriple,
    onGameOver: (finalScore) => {
      setScore(finalScore);
      openGameOver();
    },
  };

  const onEngineReady = useCallback((c: AsteroidsController | null) => {
    controllerRef.current = c;
  }, []);

  const setPausedState = (next: boolean) => {
    if (next) controllerRef.current?.pause();
    else controllerRef.current?.resume();
    setPaused(next);
  };

  // Atajo P (el motor no tiene tecla de pausa propia).
  useEffect(() => {
    if (over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" || e.repeat) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")
      )
        return;
      if (paused) controllerRef.current?.resume();
      else controllerRef.current?.pause();
      setPaused(!paused);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, paused]);

  const finish = () => {
    controllerRef.current?.pause();
    openGameOver();
  };

  const restart = () => {
    controllerRef.current?.restart();
    setTriple(0);
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(null);
  };

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await submitScore({ gameId: game.id, name: name.trim(), score });
      if (res.ok) {
        setPlayerName(name.trim());
        setSaved(true);
      } else {
        setSaveError(res.error);
      }
    } catch {
      setSaveError("No se pudo guardar la puntuación. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {triple > 0 && (
            <div className="hud-stat">
              <div className="l">Triple</div>
              <div className="v" style={{ color: "var(--cyan)" }}>{triple.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => !over && setPausedState(!paused)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>FIN</button>
          <Link className="btn ghost" href={`/games/${game.id}`}>SALIR</Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <AsteroidsCanvas events={asteroidsEvents} onReady={onEngineReady} />
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>EN PAUSA</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setTypedName(e.target.value.slice(0, 12))}
                  placeholder="TU NOMBRE"
                  maxLength={12}
                />
                <button className="btn yellow" onClick={save} disabled={saving}>
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && !saved && (
              <div style={{ color: "var(--magenta)", fontSize: 13, marginTop: 10 }}>
                {saveError}
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>JUGAR DE NUEVO</button>
              <Link className="btn magenta" href="/games">VOLVER AL VAULT</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
