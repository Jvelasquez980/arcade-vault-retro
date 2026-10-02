export const SCORE_LIMITS = { nameMax: 12, scoreMax: 10_000_000 } as const;

export function validateScoreInput(input: {
  gameId: unknown;
  name: unknown;
  score: unknown;
}):
  | { ok: true; value: { gameId: string; name: string; score: number } }
  | { ok: false; error: string } {
  const { gameId, name, score } = input;

  if (typeof gameId !== "string" || gameId.length === 0 || gameId.length > 64) {
    return { ok: false, error: "Juego inválido." };
  }

  if (typeof name !== "string") {
    return { ok: false, error: "Escribe un nombre." };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Escribe un nombre." };
  }
  if (trimmed.length > SCORE_LIMITS.nameMax) {
    return {
      ok: false,
      error: `El nombre admite máximo ${SCORE_LIMITS.nameMax} caracteres.`,
    };
  }

  if (
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > SCORE_LIMITS.scoreMax
  ) {
    return { ok: false, error: "Puntaje inválido." };
  }

  return { ok: true, value: { gameId, name: trimmed, score } };
}
