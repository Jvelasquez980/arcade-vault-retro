import { Library } from "@/components/library";
import { listGames } from "@/lib/catalog";

export default async function GamesPage() {
  const games = await listGames();
  return <Library games={games} />;
}
