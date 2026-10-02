import { notFound } from "next/navigation";
import { GamePlayer } from "@/components/game-player";
import { getGame } from "@/lib/catalog";

export default async function PlayPage(props: PageProps<"/games/[id]/jugar">) {
  const { id } = await props.params;
  const game = await getGame(id);
  if (!game || game.id !== "asteroids") notFound();

  return <GamePlayer game={game} />;
}
