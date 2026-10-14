"use client";

import { useState, type PointerEvent } from "react";
import type { TouchButton, TouchConfig } from "@/lib/games/types";

type Props = {
  config: TouchConfig;
  disabled: boolean;
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

  const setKey = (code: string, down: boolean) =>
    setPressed((prev) => {
      if (prev.has(code) === down) return prev;
      const next = new Set(prev);
      if (down) next.add(code);
      else next.delete(code);
      return next;
    });

  const press = (e: PointerEvent<HTMLButtonElement>, btn: TouchButton) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setKey(btn.code, true);
    dispatchKey("keydown", btn);
  };

  const release = (btn: TouchButton) => {
    if (!pressed.has(btn.code)) return;
    setKey(btn.code, false);
    dispatchKey("keyup", btn);
  };

  const renderBtn = (btn: TouchButton | undefined, cls: string) => {
    if (!btn) return <span className={`av-touchpad-gap ${cls}`} aria-hidden />;
    return (
      <button
        type="button"
        className={`av-touchpad-btn ${cls}${pressed.has(btn.code) ? " pressed" : ""}`}
        disabled={disabled}
        onPointerDown={(e) => press(e, btn)}
        onPointerUp={() => release(btn)}
        onPointerCancel={() => release(btn)}
        onPointerLeave={() => release(btn)}
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
