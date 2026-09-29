function FeatureIcon({ kind }: { kind: string }) {
  const C = "currentColor";
  if (kind === "GAMEPAD") return (
    <svg className="ft-icon" viewBox="0 0 16 16"><g fill={C}>
      <rect x="2" y="6" width="12" height="6"/>
      <rect x="0" y="8" width="2" height="4"/><rect x="14" y="8" width="2" height="4"/>
      <rect x="3" y="8" width="2" height="2"/><rect x="2" y="9" width="4" height="0.5"/>
      <rect x="11" y="7" width="1.5" height="1.5"/><rect x="11" y="10" width="1.5" height="1.5"/>
    </g></svg>
  );
  if (kind === "FREE") return (
    <svg className="ft-icon" viewBox="0 0 16 16"><g fill={C}>
      <rect x="3" y="3" width="10" height="10" fill="none" stroke={C} strokeWidth="1.5"/>
      <rect x="5" y="6" width="1.5" height="4"/><rect x="5" y="6" width="4" height="1.5"/><rect x="5" y="8" width="3" height="1"/>
      <rect x="10" y="6" width="1.5" height="4"/>
    </g></svg>
  );
  if (kind === "TROPHY") return (
    <svg className="ft-icon" viewBox="0 0 16 16"><g fill={C}>
      <rect x="3" y="2" width="10" height="2"/>
      <rect x="3" y="2" width="2" height="6"/><rect x="11" y="2" width="2" height="6"/>
      <rect x="5" y="8" width="6" height="2"/>
      <rect x="7" y="10" width="2" height="3"/>
      <rect x="5" y="13" width="6" height="1.5"/>
      <rect x="1" y="3" width="2" height="3"/><rect x="13" y="3" width="2" height="3"/>
    </g></svg>
  );
  if (kind === "ROCKET") return (
    <svg className="ft-icon" viewBox="0 0 16 16"><g fill={C}>
      <rect x="7" y="1" width="2" height="2"/>
      <rect x="6" y="3" width="4" height="2"/>
      <rect x="5" y="5" width="6" height="6"/>
      <rect x="4" y="11" width="2" height="2"/><rect x="10" y="11" width="2" height="2"/>
      <rect x="7" y="6" width="2" height="2" fill="#0a0a0f"/>
      <rect x="6" y="13" width="1" height="2"/><rect x="9" y="13" width="1" height="2"/>
    </g></svg>
  );
  return null;
}

const FEATURES = [
  { i: "GAMEPAD", t: "JUEGOS CLÁSICOS", d: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", c: "cyan" },
  { i: "FREE", t: "100% GRATIS", d: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", c: "yellow" },
  { i: "TROPHY", t: "LADDER BOARDS", d: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", c: "magenta" },
  { i: "ROCKET", t: "SIEMPRE CRECIENDO", d: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", c: "green" },
];

export function Features() {
  return (
    <section className="home-section reveal">
      <div className="section-head">
        <div className="kicker pixel neon-magenta">{"// 01"}</div>
        <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
        <div className="section-rule"></div>
      </div>
      <div className="feature-grid">
        {FEATURES.map((f, i) => (
          <div key={f.i} className={"feature-card " + f.c} style={{ transitionDelay: i * 80 + "ms" }}>
            <FeatureIcon kind={f.i} />
            <div className="ft-title pixel">{f.t}</div>
            <div className="ft-desc">{f.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
