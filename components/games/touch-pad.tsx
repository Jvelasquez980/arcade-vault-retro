"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { SkinId, TouchButton, TouchConfig } from "@/lib/games/types";

type Props = {
  config: TouchConfig;
  disabled: boolean;
  skin: SkinId;
};

type Dir = "up" | "right" | "down" | "left";

const ARROWS: Record<Dir, string> = {
  up: "M12 4 L20 16 L4 16 Z",
  right: "M8 4 L20 12 L8 20 Z",
  down: "M4 8 L20 8 L12 20 Z",
  left: "M16 4 L16 20 L4 12 Z",
};

const REPEAT_DELAY_MS = 250;
const REPEAT_INTERVAL_MS = 120;

type Held = {
  btn: TouchButton;
  delay?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
};

function dispatchKey(type: "keydown" | "keyup", btn: TouchButton) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key: btn.key,
      code: btn.code,
      bubbles: true,
      cancelable: true,
    }),
  );
}

export function TouchPad({ config, disabled, skin }: Props) {
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());
  const heldRef = useRef(new Map<string, Held>());

  const markPressed = (code: string, down: boolean) =>
    setPressed((prev) => {
      if (prev.has(code) === down) return prev;
      const next = new Set(prev);
      if (down) next.add(code);
      else next.delete(code);
      return next;
    });

  const press = (e: PointerEvent<HTMLButtonElement>, btn: TouchButton) => {
    if (disabled || heldRef.current.has(btn.code)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const held: Held = { btn };
    heldRef.current.set(btn.code, held);
    markPressed(btn.code, true);
    dispatchKey("keydown", btn);
    if (btn.repeat) {
      held.delay = setTimeout(() => {
        held.interval = setInterval(
          () => dispatchKey("keydown", btn),
          REPEAT_INTERVAL_MS,
        );
      }, REPEAT_DELAY_MS);
    }
  };

  const release = useCallback((code: string) => {
    const held = heldRef.current.get(code);
    if (!held) return;
    clearTimeout(held.delay);
    clearInterval(held.interval);
    heldRef.current.delete(code);
    setPressed((prev) => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
    dispatchKey("keyup", held.btn);
  }, []);

  const releaseAll = useCallback(() => {
    for (const code of [...heldRef.current.keys()]) release(code);
  }, [release]);

  // Pointer capture impide que pointerleave dispare con el dedo pulsado:
  // si el puntero sale del rect del botón, se libera a mano.
  const move = (e: PointerEvent<HTMLButtonElement>, btn: TouchButton) => {
    if (!heldRef.current.has(btn.code)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!inside) release(btn.code);
  };

  // Sin teclas atascadas: al pausar/terminar, perder foco la ventana o desmontar.
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  const handlers = (btn: TouchButton) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => press(e, btn),
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => move(e, btn),
    onPointerUp: () => release(btn.code),
    onPointerCancel: () => release(btn.code),
    onPointerLeave: () => release(btn.code),
    onContextMenu: (e: MouseEvent<HTMLButtonElement>) => e.preventDefault(),
  });

  const { dpad, actions } = config;

  const renderDir = (dir: Dir) => {
    const btn = dpad[dir];
    return (
      <button
        type="button"
        className={`av-gp-dp av-gp-dp-${dir}${btn && pressed.has(btn.code) ? " on" : ""}`}
        aria-label={btn?.label ?? dir}
        disabled={!btn || disabled}
        {...(btn ? handlers(btn) : {})}
      >
        <svg className="av-gp-arrow" viewBox="0 0 24 24" aria-hidden>
          <path d={ARROWS[dir]} fill="currentColor" />
        </svg>
      </button>
    );
  };

  const renderAction = (letter: "A" | "B", btn: TouchButton | undefined) => (
    <div className="av-gp-ab-wrap">
      <button
        type="button"
        className={`av-gp-ab ${letter.toLowerCase()}${btn && pressed.has(btn.code) ? " on" : ""}`}
        aria-label={btn?.label ?? letter}
        disabled={!btn || disabled}
        {...(btn ? handlers(btn) : {})}
      >
        <span className="av-gp-ring" aria-hidden />
        <span className="av-gp-letter">{letter}</span>
      </button>
      <span className="av-gp-label" aria-hidden>
        {btn?.label}
      </span>
    </div>
  );

  return (
    <div
      className="av-gp"
      data-skin={skin}
      role="group"
      aria-label="Controles táctiles"
    >
      <div className="av-gp-body">
        <div className="av-gp-dpad" role="group" aria-label="D-pad">
          {renderDir("up")}
          {renderDir("right")}
          {renderDir("down")}
          {renderDir("left")}
          <div className="av-gp-hub" aria-hidden>
            <span className="av-gp-gem" />
          </div>
        </div>
        <div className="av-gp-actions">
          {renderAction("B", actions?.[1])}
          {renderAction("A", actions?.[0])}
        </div>
      </div>
    </div>
  );
}
