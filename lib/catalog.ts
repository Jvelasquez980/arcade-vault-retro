import { createClient } from "@/lib/supabase/server";

export * from "@/lib/catalog-shared";
import type { Accent, Category, Game } from "@/lib/catalog-shared";

type GameRow = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  color: Accent;
  cover: string;
  players_min: number;
  players_max: number;
  controls: Game["controls"];
  tags: string[];
  difficulty: number;
};

const COLUMNS =
  "id, title, short, long, cat, color, cover, players_min, players_max, controls, tags, difficulty";

function toGame(row: GameRow, stats?: { plays: number; best: number }): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat,
    color: row.color,
    cover: row.cover,
    playersMin: row.players_min,
    playersMax: row.players_max,
    controls: row.controls,
    tags: row.tags,
    difficulty: row.difficulty,
    plays: stats?.plays ?? 0,
    best: stats?.best ?? 0,
  };
}

// Publicados, por sort_order. Lanza si Supabase falla (lo atrapa app/error.tsx).
export async function listGames(opts?: { limit?: number }): Promise<Game[]> {
  const supabase = await createClient();

  let query = supabase
    .from("games")
    .select(COLUMNS)
    .eq("published", true)
    .order("sort_order")
    .order("created_at");
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar el catálogo");
  const rows = data as GameRow[];
  if (rows.length === 0) return [];

  const { data: stats, error: statsError } = await supabase
    .from("game_stats")
    .select("game_id, plays, best")
    .in(
      "game_id",
      rows.map((r) => r.id),
    );
  if (statsError) throw new Error("No se pudo cargar el catálogo");

  const byId = new Map(stats.map((s) => [s.game_id as string, s]));
  return rows.map((r) => toGame(r, byId.get(r.id)));
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("games")
    .select(COLUMNS)
    .eq("id", id)
    .eq("published", true)
    .maybeSingle<GameRow>();
  if (error) throw new Error("No se pudo cargar el juego");
  if (!row) return null;

  const { data: stats, error: statsError } = await supabase
    .from("game_stats")
    .select("plays, best")
    .eq("game_id", id)
    .maybeSingle();
  if (statsError) throw new Error("No se pudo cargar el juego");

  return toGame(row, stats ?? undefined);
}
