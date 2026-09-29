"use client";

import { useActionState, useState } from "react";
import { sendContact } from "@/app/about/actions";
import type { ContactState } from "@/lib/contact";

const EMPTY = { name: "", email: "", message: "" };
const INITIAL: ContactState = { status: "idle", values: EMPTY };

export function ContactForm() {
  // Cambiar la key remonta el formulario y reinicia el estado de la acción.
  const [resetKey, setResetKey] = useState(0);
  return <ContactFormInner key={resetKey} onReset={() => setResetKey((k) => k + 1)} />;
}

function ContactFormInner({ onReset }: { onReset: () => void }) {
  const [state, formAction, pending] = useActionState(sendContact, INITIAL);
  const [seen, setSeen] = useState(state);
  const [shaking, setShaking] = useState(false);

  // Cada respuesta nueva `invalid` dispara un shake.
  if (state !== seen) {
    setSeen(state);
    setShaking(state.status === "invalid");
  }

  const values = state.status === "success" ? EMPTY : state.values;

  return (
    <section className="about-contact reveal">
      <div className="contact-grid">
        <div className="contact-intro">
          <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
          <h2 className="contact-title">CONTÁCTANOS</h2>
          <p className="contact-sub">
            ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
            Escríbenos.
          </p>
          <div className="contact-tips">
            <div className="tip"><span className="tip-led"></span>RESPUESTA EN 24-48H</div>
            <div className="tip"><span className="tip-led y"></span>SUGERENCIAS BIENVENIDAS</div>
            <div className="tip"><span className="tip-led m"></span>SIN SPAM, JAMÁS</div>
          </div>
        </div>

        <form
          className={"contact-form" + (shaking ? " shake" : "")}
          action={formAction}
          onAnimationEnd={() => setShaking(false)}
          noValidate
        >
          {state.status !== "success" ? (
            <>
              <div className="field">
                <label htmlFor="contact-name">NOMBRE</label>
                <input
                  id="contact-name"
                  name="name"
                  defaultValue={values.name}
                  placeholder="px_kai"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  defaultValue={values.email}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-msg">MENSAJE</label>
                <textarea
                  id="contact-msg"
                  rows={5}
                  name="message"
                  defaultValue={values.message}
                  placeholder="Cuéntanos qué tienes en mente…"
                ></textarea>
              </div>
              <input
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              {state.status === "error" && (
                <p className="form-error" role="alert">
                  {state.message}
                </p>
              )}
              <button
                className="btn xl press"
                type="submit"
                disabled={pending}
                style={{ width: "100%" }}
              >
                {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
              </button>
            </>
          ) : (
            <div className="terminal-success">
              <div className="term-bar">
                <span className="dot r"></span><span className="dot y"></span><span className="dot g"></span>
                <span className="term-title">VAULT-OS // TERMINAL</span>
              </div>
              <div className="term-body">
                <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
                <div className="line dim">[OK] Conectando con servidor…</div>
                <div className="line dim">[OK] Validando contenido…</div>
                <div className="line dim">[OK] Transmitiendo paquete…</div>
                <div className="line success">
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {state.name.toUpperCase()}.
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={onReset}
                  >
                    ENVIAR OTRO MENSAJE
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
