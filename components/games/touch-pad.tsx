"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { TouchButton, TouchConfig } from "@/lib/games/types";

type Props = {
  config: TouchConfig;
  disabled: boolean;
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

export function TouchPad({ config, disabled }: Props) {
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

  const renderBtn = (btn: TouchButton | undefined, cls: string) => {
    if (!btn) return <span className={`av-touchpad-gap ${cls}`} aria-hidden />;
    return (
      <button
        type="button"
        className={`av-touchpad-btn ${cls}${pressed.has(btn.code) ? " pressed" : ""}`}
        disabled={disabled}
        onPointerDown={(e) => press(e, btn)}
        onPointerMove={(e) => move(e, btn)}
        onPointerUp={() => release(btn.code)}
        onPointerCancel={() => release(btn.code)}
        onPointerLeave={() => release(btn.code)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {btn.label}
      </button>
    );
  };

  const { dpad, actions } = config;

  return (
    <div className="av-touchpad" aria-label="Controles táctiles">
      <div className="av-touchpad-dpad">
        {renderBtn(dpad.up, "up")}
        {renderBtn(dpad.left, "left")}
        {renderBtn(dpad.right, "right")}
        {renderBtn(dpad.down, "down")}
      </div>
      {actions && actions.length > 0 && (
        <div className="av-touchpad-actions">
          {actions.map((a) => (
            <span key={a.code} className="av-touchpad-action">
              {renderBtn(a, "action")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
