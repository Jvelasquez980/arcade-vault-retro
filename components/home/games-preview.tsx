import Link from "next/link";
import { listGames, type Game } from "@/lib/catalog";

function MiniCard({ game }: { game: Game }) {
  return (
    <Link className="mini-card" href={`/games/${game.id}`} style={{ display: "block" }}>
      <div className="mini-cover"><div className={"cover-bg " + game.cover}></div></div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}

export async function GamesPreview() {
  const games = await listGames({ limit: 6 });

  return (
    <section className="home-section reveal">
      <div className="section-head">
        <div className="kicker pixel neon-cyan">{"// 02"}</div>
        <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
        <div className="section-rule"></div>
      </div>
      <div className="mini-rail">
        {games.map((g) => (
          <MiniCard key={g.id} game={g} />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link className="btn lg" href="/games">VER TODOS LOS JUEGOS →</Link>
      </div>
    </section>
  );
}
