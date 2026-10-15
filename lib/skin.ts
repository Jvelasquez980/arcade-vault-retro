// Preferencia de skin por juego en localStorage (clave av_skin_<id>). Solo client-side.
import { SKINS, type SkinId } from "@/lib/games/types";

// Juegos con skins implementadas (lib/games/<id>/skins.ts). El selector solo se muestra en ellos.
const SKINNED_GAMES = new Set<string>([
  "asteroids",
  "snake",
  "tetris",
  "arkanoid",
  "frogger",
]);

export const hasSkins = (gameId: string) => SKINNED_GAMES.has(gameId);

const isSkinId = (v: unknown): v is SkinId => SKINS.some((s) => s.id === v);

const key = (gameId: string) => `av_skin_${gameId}`;

export function getSkin(gameId: string): SkinId {
  try {
    const raw = window.localStorage.getItem(key(gameId));
    return isSkinId(raw) ? raw : "classic";
  } catch {
    return "classic";
  }
}

export function setSkin(gameId: string, skin: SkinId): void {
  try {
    window.localStorage.setItem(key(gameId), skin);
  } catch {}
}
