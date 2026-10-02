"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyBest } from "@/app/salon/actions";
import { useSession } from "@/components/session-provider";
import { formatDate, type Game } from "@/lib/catalog-shared";
import type { ScoreRow } from "@/lib/leaderboard";

type Props = { games: Game[]; scoresByGame: Record<string, ScoreRow[]> };

function Slot({
  cls,
  rank,
  row,
  big,
}: {
  cls: string;
  rank: string;
  row: ScoreRow | undefined;
  big?: boolean;
}) {
  return (
    <div className={"podium-slot " + cls}>
      {big && (
        <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
          CAMPEÓN
        </div>
      )}
      <div className="rank-num" style={big ? { fontSize: 36, marginTop: 4 } : undefined}>
        {rank}
      </div>
      <div className="name">{row ? row.name : "—"}</div>
      <div className="score" style={big ? { fontSize: 20 } : undefined}>
        {row ? row.score.toLocaleString("es-ES") : "—"}
      </div>
      <div className="date">{row ? formatDate(row.createdAt) : ""}</div>
    </div>
  );
}

export function HallOfFame({ games, scoresByGame }: Props) {
  const { user } = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [mine, setMine] = useState<{ key: string; row: ScoreRow | null } | null>(null);

  const tab = selected ?? games[0]?.id ?? null;
  const game = games.find((g) => g.id === tab) ?? null;
  const rows = (tab && scoresByGame[tab]) || [];
  const userName = user?.name ?? null;
  const key = tab && userName ? `${tab}\u0000${userName}` : null;

  useEffect(() => {
    if (!tab || !userName || !key) return;
    let cancelled = false;
    getMyBest(tab, userName).then((row) => {
      if (!cancelled) setMine({ key, row });
    });
    return () => {
      cancelled = true;
    };
  }, [tab, userName, key]);

  const myRow = mine && mine.key === key ? mine.row : null;
  const loadedMine = mine !== null && mine.key === key;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setSelected(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 16px",
            color: "var(--ink-faint)",
            letterSpacing: "0.12em",
            fontSize: 12,
          }}
        >
          AÚN NO HAY PUNTAJES · SÉ EL PRIMERO
        </div>
      ) : (
        <>
          <div className="podium">
            <Slot cls="silver" rank="02" row={rows[1]} />
            <Slot cls="gold" rank="01" row={rows[0]} big />
            <Slot cls="bronze" rank="03" row={rows[2]} />
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={`${r.createdAt}-${i}`}
                className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{formatDate(r.createdAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {user && game && (
        <div className="hall-table" style={{ marginTop: 16 }}>
          <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
          <div className="tr you">
            <div className="rk" style={{ color: "var(--yellow)" }}>—</div>
            <div className="pl" style={{ color: "var(--yellow)" }}>{user.name}</div>
            {myRow ? (
              <>
                <div
                  className="sc"
                  style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
                >
                  {myRow.score.toLocaleString("es-ES")}
                </div>
                <div className="dt">{formatDate(myRow.createdAt)}</div>
              </>
            ) : (
              <>
                <div className="sc" style={{ color: "var(--ink-faint)" }}>
                  {loadedMine ? "AÚN SIN MARCA" : "…"}
                </div>
                <div className="dt">—</div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/games">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
