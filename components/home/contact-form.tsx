"use client";

import { useState } from "react";

const EMPTY = { name: "", email: "", msg: "" };

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setSent(form.name.trim());
  };

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

        <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit} noValidate>
          {!sent ? (
            <>
              <div className="field">
                <label htmlFor="contact-name">NOMBRE</label>
                <input
                  id="contact-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="px_kai"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jugador@vault.gg"
                />
              </div>
              <div className="field">
                <label htmlFor="contact-msg">MENSAJE</label>
                <textarea
                  id="contact-msg"
                  rows={5}
                  value={form.msg}
                  onChange={(e) => setForm({ ...form, msg: e.target.value })}
                  placeholder="Cuéntanos qué tienes en mente…"
                ></textarea>
              </div>
              <button className="btn xl press" type="submit" style={{ width: "100%" }}>
                ▶  ENVIAR MENSAJE
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
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sent.toUpperCase()}.
                  <span className="caret">_</span>
                </div>
                <div style={{ marginTop: 18 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      setSent(null);
                      setForm(EMPTY);
                    }}
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
