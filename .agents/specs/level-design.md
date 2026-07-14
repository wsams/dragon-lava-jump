# Level Design

> Seed, length, goal, dots, power-up placement, and replay behavior (shared across biomes).

## Summary

- **Seed:** Random seed drives level generation per biome. Same seed + same biome produces the same layout.
- **Length:** Level length is fixed at 4000 px. World height is **dynamic** per level.
- **Goal:** Goal at the end of the level. Win sequence: dragon enters the door (animation), `music.mp3` fades down, `win.mp3` plays, win overlay fades in after a short delay. Styling may differ per biome (e.g. golden door vs desert pillar).
- **Dots:** 30 collectible dots per level. Collecting one uses `dot.mp3`. Dots and checkpoints are never placed near static obstacles: they avoid slimes, cacti, and the band under stalactites (`STALACTITE_AVOID_BAND`). Checkpoints are not placed on platforms that have a slime, cactus, or stalactite above them.
- **Power-ups (placement):** Lava orb, fire totem, and (in Desert) chomp are placed above a platform (centered with small wiggle) so they are reachable; when no platforms are provided they fall back to a world-height–based position.
- **Replay:** Replay always starts from the beginning, not from the last checkpoint.

## Requirements

- Same seed + same biome = same layout every time.
- Level length 4000 px; world height dynamic per level.
- Win: door animation, music fade, win sound, overlay after delay; biome-specific goal styling allowed.
- 30 dots per level; placement avoids slimes, cacti, stalactite band; checkpoints not on platforms with slime/cactus/stalactite above.
- Power-ups placed above platforms (centered, small wiggle) or fallback to world-height position.
- Replay = from start of level, not from checkpoint.

## References

- [Biomes](biomes.md) — biome and seed
- [Checkpoints](checkpoints.md) — checkpoint count and placement rules
- [Power-ups](power-ups.md) — orb, totem, chomp placement
- [Biome: Cave](biome-cave.md) — stalactites, layout
- [Biome: Desert](biome-desert.md) — cacti, layout
- [Audio](audio.md) — music, win, dot
