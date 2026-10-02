import Link from "next/link";
import { notFound } from "next/navigation";
import { controlsLabel, formatDate, formatPlays, playersLabel } from "@/lib/catalog-shared";
import { getGame } from "@/lib/catalog";
import { getTopScores } from "@/lib/leaderboard";

export default async function GameDetailPage(props: PageProps<"/games/[id]">) {
  const { id } = await props.params;
  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getTopScores(id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>{playersLabel(game.playersMin, game.playersMax)}</span>
            <span>{controlsLabel(game.controls)}</span>
            {game.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{formatPlays(game.plays)}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
              >
                {Array.from({ length: 5 }, (_, i) => (i < game.difficulty ? "★" : "☆")).join(" ")}
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/games/${game.id}/jugar`}>
              ▶  JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/games">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 && (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                fontSize: 11,
                letterSpacing: "0.12em",
                color: "var(--ink-faint)",
              }}
            >
              AÚN NO HAY PUNTAJES · SÉ EL PRIMERO
            </div>
          )}
          {scores.map((r, i) => (
            <div
              key={`${r.createdAt}-${i}`}
              className={
                "lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
              <div className="pl">
                {r.name}
                <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
                  {formatDate(r.createdAt)}
                </div>
              </div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
