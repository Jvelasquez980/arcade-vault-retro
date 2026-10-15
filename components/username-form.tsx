"use client";

import { useActionState } from "react";
import { chooseUsername } from "@/app/auth/actions";
import { AUTH_LIMITS, type AuthState } from "@/lib/auth-validation";

const initial: AuthState = {};

export function UsernameForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(chooseUsername, initial);

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ELIGE TU USUARIO</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Así te verán en el salón de la fama. No podrás cambiarlo después.
          </div>
        </div>

        <form action={action}>
          <input type="hidden" name="next" value={next} />
          <div className="field">
            <label htmlFor="un-user">Usuario</label>
            <input
              id="un-user"
              name="username"
              autoComplete="username"
              required
              autoFocus
              minLength={AUTH_LIMITS.usernameMin}
              maxLength={AUTH_LIMITS.usernameMax}
              pattern="[A-Za-z0-9_]+"
              title="Letras, números y guion bajo"
              defaultValue={state.values?.username}
              placeholder="PX_KAI"
              style={{ textTransform: "uppercase" }}
              aria-invalid={!!state.error}
            />
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-faint)" }}
            >
              {AUTH_LIMITS.usernameMin} a {AUTH_LIMITS.usernameMax} caracteres:
              letras, números y _
            </div>
            {state.error && (
              <div className="field-error" role="alert">
                {state.error}
              </div>
            )}
          </div>
          <button
            className="btn lg"
            type="submit"
            disabled={pending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {pending ? "GUARDANDO…" : "GUARDAR USUARIO"}
          </button>
        </form>
      </div>
    </div>
  );
}
