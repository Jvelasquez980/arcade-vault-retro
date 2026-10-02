import { createClient } from "@/lib/supabase/server";

export type ScoreRow = { name: string; score: number; createdAt: string };

type Row = { name: string; score: number; created_at: string };

function toRow(r: Row): ScoreRow {
  return { name: r.name, score: r.score, createdAt: r.created_at };
}

// Orden: score desc, created_at asc (desempata el más antiguo).
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("No se pudo cargar el ranking");
  return (data as Row[]).map(toRow);
}

export async function getBestByName(
  gameId: string,
  name: string,
): Promise<ScoreRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .eq("name", name)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Row>();
  if (error) throw new Error("No se pudo cargar el ranking");
  return data ? toRow(data) : null;
}
