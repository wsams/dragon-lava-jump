# Technical Notes

> License, constants, physics, and storage keys.

## Summary

- **No license:** This project is not licensed for reuse or distribution. Do not add license files or license sections.
- **Constants:** Physics and layout constants are at the top of `game-phaser.js`. Desert-specific constants (e.g. `CACTUS_*`, `SCORPION_*`, `BUZZARD_*`) are with the biome section. Change them carefully.
- **Physics:** Arcade physics. Player hitbox is fixed; do not tie it to facing direction.
- **Storage:** Levels and progress are saved in localStorage. Use keys: `dragonLevels`, `dragonProfile`, `dragonAudio`, `dragonDifficulty`, `dragonBiome`, `dragonScores`.

## Requirements

- Do not add license files or license sections to the project.
- When changing physics or layout constants, update this spec or the relevant feature spec if behavior changes.
- Player hitbox: fixed size; not dependent on facing direction.
- localStorage keys: use only the listed keys for the listed purposes; do not introduce new keys without documenting them here or in the relevant spec.

## References

- [Project Structure](project-structure.md) — game-phaser.js
- [Biomes](biomes.md) — dragonBiome
- [UI](ui.md) — persistence (audio, difficulty, biome)
- [Score](score.md) — dragonScores (implied; see leaderboard/score storage)
