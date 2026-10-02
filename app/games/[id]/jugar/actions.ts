"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateScoreInput } from "@/lib/scores-validation";

export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = validateScoreInput(input);
  if (!parsed.ok) return parsed;

  const { gameId, name, score } = parsed.value;
  const generic = {
    ok: false,
    error: "No se pudo guardar la puntuación. Inténtalo de nuevo.",
  } as const;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_score", {
      p_game_id: gameId,
      p_name: name,
      p_score: score,
    });
    if (error) return generic;
  } catch {
    return generic;
  }

  revalidatePath("/salon");
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}
