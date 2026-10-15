"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, signInWithProvider, signUp } from "@/app/auth/actions";
import { AUTH_LIMITS, type AuthState } from "@/lib/auth-validation";

const initial: AuthState = {};

function FieldError({ state, field }: { state: AuthState; field: string }) {
  if (!state.error || state.field !== field) return null;
  return (
    <div className="field-error" role="alert">
      {state.error}
    </div>
  );
}

// Errores sin campo concreto (credenciales, fallos del servidor).
function FormError({ state }: { state: AuthState }) {
  if (!state.error || state.field) return null;
  return (
    <div className="auth-error" role="alert">
      {state.error}
    </div>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="si-email">Correo electrónico</label>
        <input
          id="si-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={AUTH_LIMITS.email}
          defaultValue={state.values?.email}
          placeholder="jugador@vault.gg"
        />
      </div>
      <div className="field">
        <label htmlFor="si-pass">Contraseña</label>
        <input
          id="si-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      <FormError state={state} />
      <button
        className="btn lg"
        type="submit"
        disabled={pending}
        style={{ width: "100%", marginTop: 8 }}
      >
        {pending ? "ENTRANDO…" : "ENTRAR AL VAULT"}
      </button>
      <Link href="/auth/recuperar" className="auth-link">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);

  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="su-user">Usuario</label>
        <input
          id="su-user"
          name="username"
          autoComplete="username"
          required
          minLength={AUTH_LIMITS.usernameMin}
          maxLength={AUTH_LIMITS.usernameMax}
          pattern="[A-Za-z0-9_]+"
          title="Letras, números y guion bajo"
          defaultValue={state.values?.username}
          placeholder="PX_KAI"
          style={{ textTransform: "uppercase" }}
          aria-invalid={state.field === "username"}
        />
        <FieldError state={state} field="username" />
      </div>
      <div className="field">
        <label htmlFor="su-email">Correo electrónico</label>
        <input
          id="su-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={AUTH_LIMITS.email}
          defaultValue={state.values?.email}
          placeholder="jugador@vault.gg"
          aria-invalid={state.field === "email"}
        />
        <FieldError state={state} field="email" />
      </div>
      <div className="field">
        <label htmlFor="su-pass">Contraseña</label>
        <input
          id="su-pass"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={AUTH_LIMITS.passwordMin}
          placeholder={`Mínimo ${AUTH_LIMITS.passwordMin} caracteres`}
          aria-invalid={state.field === "password"}
        />
        <FieldError state={state} field="password" />
      </div>
      <FormError state={state} />
      <button
        className="btn lg"
        type="submit"
        disabled={pending}
        style={{ width: "100%", marginTop: 8 }}
      >
        {pending ? "CREANDO…" : "CREAR Y JUGAR"}
      </button>
    </form>
  );
}

export function AuthForm({ next, error }: { next: string; error?: string }) {
  const [tab, setTab] = useState<"in" | "up">("in");

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {tab === "in" ? <SignInForm next={next} /> : <SignUpForm next={next} />}

        <Link
          href="/"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
        >
          JUGAR COMO INVITADO
        </Link>

        <div className="auth-divider">O CONTINÚA CON</div>
        <form action={signInWithProvider} className="social">
          <input type="hidden" name="next" value={next} />
          <button
            className="btn ghost"
            type="submit"
            name="provider"
            value="google"
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="submit"
            name="provider"
            value="github"
          >
            ▣ GITHUB
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
