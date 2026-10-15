"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/app/auth/actions";
import { AUTH_LIMITS, type AuthState } from "@/lib/auth-validation";

const initial: AuthState = {};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RecoverForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    initial,
  );

  if (state.done) {
    return (
      <Card title="REVISA TU CORREO">
        <p
          className="mono"
          style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-dim)" }}
        >
          Si {state.values?.email} tiene una cuenta, te enviamos un enlace para
          crear una contraseña nueva.
        </p>
        <Link
          href="/auth"
          className="btn ghost"
          style={{ width: "100%", marginTop: 16 }}
        >
          VOLVER A INICIAR SESIÓN
        </Link>
      </Card>
    );
  }

  return (
    <Card title="RECUPERAR CONTRASEÑA">
      <form action={action}>
        <div className="field">
          <label htmlFor="rc-email">Correo electrónico</label>
          <input
            id="rc-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            maxLength={AUTH_LIMITS.email}
            defaultValue={state.values?.email}
            placeholder="jugador@vault.gg"
            aria-invalid={state.field === "email"}
          />
          {state.error && state.field === "email" && (
            <div className="field-error" role="alert">
              {state.error}
            </div>
          )}
        </div>
        {state.error && !state.field && (
          <div className="auth-error" role="alert">
            {state.error}
          </div>
        )}
        <button
          className="btn lg"
          type="submit"
          disabled={pending}
          style={{ width: "100%", marginTop: 8 }}
        >
          {pending ? "ENVIANDO…" : "ENVIAR ENLACE"}
        </button>
        <Link href="/auth" className="auth-link">
          Volver a iniciar sesión
        </Link>
      </form>
    </Card>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);

  return (
    <Card title="NUEVA CONTRASEÑA">
      <form action={action}>
        <div className="field">
          <label htmlFor="np-pass">Contraseña nueva</label>
          <input
            id="np-pass"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={AUTH_LIMITS.passwordMin}
            placeholder={`Mínimo ${AUTH_LIMITS.passwordMin} caracteres`}
            aria-invalid={state.field === "password"}
          />
          {state.error && state.field === "password" && (
            <div className="field-error" role="alert">
              {state.error}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="np-confirm">Repite la contraseña</label>
          <input
            id="np-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={AUTH_LIMITS.passwordMin}
            placeholder="••••••••"
          />
        </div>
        {state.error && !state.field && (
          <div className="auth-error" role="alert">
            {state.error}
          </div>
        )}
        <button
          className="btn lg"
          type="submit"
          disabled={pending}
          style={{ width: "100%", marginTop: 8 }}
        >
          {pending ? "GUARDANDO…" : "GUARDAR CONTRASEÑA"}
        </button>
      </form>
    </Card>
  );
}
