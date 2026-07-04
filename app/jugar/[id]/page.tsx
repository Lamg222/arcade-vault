import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GAMES } from "../../data/games";
import Player from "../../components/Player";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  return { title: game ? `Jugando: ${game.title}` : "Juego no encontrado" };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <Player game={game} />;
}
