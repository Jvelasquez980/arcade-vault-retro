# Sugerencias de juegos — Arcade Vault

## Pendientes

- [ ] **Frogger** · ARCADE · 4.4/5 · sugerido por: game-planner · 2026-10-14 — cruzar carriles/río; vidas + niveles (velocidad), puntaje por avance/llegadas/tiempo; mecánica nueva, dibujable con primitivas.
- [ ] **Space Invaders** · SHOOTER · 4.3/5 · sugerido por: game-planner · 2026-10-14 — oleadas = niveles, 3 vidas, puntaje por alien/OVNI; motor simple, pero solapa con Asteroids (SHOOTER).
- [ ] **2048** · PUZZLE · 4.1/5 · sugerido por: game-planner · 2026-10-14 — motor trivial y puntaje natural, sin vidas/niveles; partidas largas.
- [ ] **Pong vs CPU** · VERSUS · 4.0/5 · sugerido por: game-planner · 2026-10-14 — llenaría VERSUS (1 jugador vs IA), pero puntaje poco competible en leaderboard.
- [ ] **Missile Command** · SHOOTER · 4.6/5 · game-planner · 2026-10-14 — mira + contramisiles defendiendo 6 ciudades; sin vidas, oleadas = niveles; complejidad baja, sin assets.
- [ ] **Pac-Man** · ARCADE · 4.4/5 · game-planner · 2026-10-14 — laberinto, 4 fantasmas, power pill; 3 vidas + niveles; media-alta (IA); parecido a Snake (rejilla).
- [ ] **Lunar Lander** · ARCADE · 4.4/5 · game-planner · 2026-10-14 — empuje/rotación, combustible limitado, zonas con multiplicador; física nueva en catálogo; baja. (Propuesto por 2 agentes.)
- [ ] **Robotron 2084** · SHOOTER · 4.4/5 · game-planner · 2026-10-14 — WASD + disparo 8 direcciones, 3 vidas, oleadas; media.
- [ ] **Puzzle Bobble** · PUZZLE · 4.4/5 · game-planner · 2026-10-14 — cañón de burbujas, 3+ del mismo color caen, techo baja; media; distinto a Tetris.
- [ ] **Endless Runner** · ARCADE · 4.3/5 · game-planner · 2026-10-14 — salto de obstáculos a velocidad creciente, puntaje por distancia; baja.
- [ ] **Centipede** · SHOOTER · 4.2/5 · game-planner · 2026-10-14 — cañón vs ciempiés entre hongos, 3 vidas; media.
- [ ] **Columns** · PUZZLE · 4.2/5 · game-planner · 2026-10-14 — columnas de 3 joyas, combos; baja; se parece a Tetris.
- [ ] **Tron vs CPU** · VERSUS · 4.2/5 · game-planner · 2026-10-14 — motos con estela en rejilla, 3 vidas, rondas; baja; base posible: motor Snake.
- [ ] **Match-3 contrarreloj** · PUZZLE · 4.1/5 · game-planner · 2026-10-14 — intercambio de gemas, reloj 60–90 s, cascadas; media.
- [ ] **Road Fighter** · ARCADE (carreras) · 4.0/5 · game-planner · 2026-10-14 — esquivar tráfico con scroll vertical, combustible; media.
- [ ] **Galaga** · SHOOTER · 3.9/5 · game-planner · 2026-10-14 — formaciones en picada, 3 vidas; media-alta; solapa con Space Invaders.
- [ ] **Dig Dug-lite** · ARCADE · 3.8/5 · game-planner · 2026-10-14 — cavar e inflar enemigos, rocas; media-alta.
- [ ] **Minesweeper por teclado** · PUZZLE · 3.8/5 · game-planner · 2026-10-14 — cursor + bandera, 1 vida; baja; mejor con mouse.
- [ ] **Helicopter** · ARCADE · 3.7/5 · game-planner · 2026-10-14 — mantener tecla para subir en cueva que se estrecha; baja; puntaje por distancia.
- [ ] **1942** · SHOOTER · 3.7/5 · game-planner · 2026-10-14 — shmup vertical con power-ups y jefes; alta.
- [ ] **Q*bert** · ARCADE · 3.5/5 · game-planner · 2026-10-14 — saltos diagonales en pirámide isométrica; media.
- [ ] **Sokoban** · PUZZLE · 3.5/5 · game-planner · 2026-10-14 — empujar cajas, niveles fijos; media; puntaje poco competible.
- [ ] **Bomberman vs CPU** · VERSUS · 3.5/5 · game-planner · 2026-10-14 — bombas en laberinto vs bots; alta.

## Aceptados (en spec)

## Implementados

- [x] Asteroids, Tetris, Arkanoid, Snake

## Descartados

## Notas / preferencias

- `Accent` (lib/catalog-shared.ts) solo admite cyan/magenta/green/yellow, todos usados: un juego nuevo con color propio requiere ampliar el tipo + clase `cover-*`.
