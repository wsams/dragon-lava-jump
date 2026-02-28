# Player Mechanics

> Jump, double jump, slam down, boost, and fire breath behavior.

## Summary

- **Jump:** Standard jump and double jump. One double jump per flight; it resets only when landing on a real platform (not the purple double-jump phantom). Ground detection uses a lenient platform edge (`GROUND_EDGE_TOLERANCE`, `GROUND_TOP_TOLERANCE`) so jumping from the very tip of a platform counts as a ground jump. Uses `jump.mp3`.
- **Slam down (↓ / S):** Hold Down (or S) while in the air to drop straight downward at a fixed fast speed (Tetris-style). Not instant—a quick animation (`SLAM_DOWN_VY`). Use to avoid hazards by shooting down. No effect when on ground. Onscreen: horizontal Down button between Left and Right (75% height).
- **Boost (F):** Horizontal-only, forward dash in mid-air. Once per jump. No vertical component. Uses `boost.mp3`.
- **Fire breath (G):** Available only when you have the fire totem. Kills slimes, crawlers, and bats (Cave) and scorpions and buzzards (Desert). Uses `breath.mp3`.

## Requirements

- Double jump: exactly one per flight; reset only on landing on a real platform.
- Slam down: only in air; fixed downward speed; no effect on ground; Down/S and on-screen Down button.
- Boost: horizontal only, once per jump, no vertical component.
- Fire breath: only with fire totem; kills the correct creatures per biome (Cave vs Desert).

## References

- [Player (Dragon)](player-dragon.md) — controls and double-jump platform
- [Power-ups](power-ups.md) — fire totem and chomp
- [Biome: Cave](biome-cave.md) — slime, bat, crawler
- [Biome: Desert](biome-desert.md) — scorpion, buzzard
- [Audio](audio.md) — jump, boost, breath keys and paths
