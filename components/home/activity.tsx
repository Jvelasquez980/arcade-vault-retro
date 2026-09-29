import Link from "next/link";
import { ACTIVITY, TOP_TODAY } from "@/lib/home-data";

export function Activity() {
  return (
    <section className="home-section reveal">
      <div className="section-head">
        <div className="kicker pixel neon-yellow">{"// 03"}</div>
        <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
        <div className="section-rule"></div>
      </div>
      <div className="activity-grid">
        <div className="activity-card">
          <div className="ac-head">
            <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
          </div>
          <div className="ticker">
            {ACTIVITY.map((r, i) => (
              <div key={r.p} className="tick-row" style={{ animationDelay: i * 60 + "ms" }}>
                <span className={"tk-p neon-" + r.c}>{r.p}</span>
                <span className="tk-mid">▸ {r.g}</span>
                <span className="tk-s">+{r.s.toLocaleString("es-ES")}</span>
                <span className="tk-t">{r.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="activity-card">
          <div className="ac-head">
            <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
            <Link className="lb-link" href="/salon">VER SALÓN →</Link>
          </div>
          <div className="top-list">
            {TOP_TODAY.map((r, i) => (
              <div
                key={r.p}
                className={"top-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
              >
                <span className="tp-rk">#{String(r.r).padStart(2, "0")}</span>
                <span className="tp-bar"><span className="tp-fill" style={{ width: 100 - i * 16 + "%" }}></span></span>
                <span className="tp-p">{r.p}</span>
                <span className="tp-s">{r.s.toLocaleString("es-ES")}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
