"use server";

import { getBestByName } from "@/lib/leaderboard";
import type { ScoreRow } from "@/lib/leaderboard";

export async function getMyBest(gameId: string, name: string): Promise<ScoreRow | null> {
  if (typeof gameId !== "string" || typeof name !== "string" || !name.trim()) return null;
  try {
    return await getBestByName(gameId, name.trim());
  } catch {
    return null;
  }
}
