"use server";

import { getBestByUser } from "@/lib/leaderboard";
import type { ScoreRow } from "@/lib/leaderboard";
import { createClient } from "@/lib/supabase/server";

// Mejor puntaje del usuario de la sesión; el id nunca viene del cliente.
export async function getMyBest(gameId: string): Promise<ScoreRow | null> {
  if (typeof gameId !== "string") return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return await getBestByUser(gameId, user.id);
  } catch {
    return null;
  }
}
