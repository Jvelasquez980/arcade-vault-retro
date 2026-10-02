import { HallOfFame } from "@/components/hall-of-fame";
import { listGames } from "@/lib/catalog";
import { getTopScores } from "@/lib/leaderboard";

export default async function SalonPage() {
  const games = await listGames();
  const entries = await Promise.all(
    games.map(async (g) => [g.id, await getTopScores(g.id, 12)] as const),
  );
  return <HallOfFame games={games} scoresByGame={Object.fromEntries(entries)} />;
}
