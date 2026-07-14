# Biomes

> Biome system: world style, level generation, and per-biome entities (creatures, obstacles, power-ups).

## Summary

- **Concept:** A biome defines world style, level layout generation, and biome-specific creatures, obstacles, and power-ups. The same seed and difficulty produce different levels per biome.
- **Registry:** In `game-phaser.js` (e.g. `BIOMES.default`, `BIOMES.desert`). Each biome has `id`, `name`, `assetBasePath`, and `generateLevel(difficulty, seed, H)`.
- **Entity lists:** Each biome declares arrays: `creatures`, `obstacles`, `powerUps`. Level generation uses `runBiomeGenerators(biome, options)` to fill layout from these lists. Scene create/update use the same lists to spawn and tick only the entities for the current biome. Implementations (slime, bat, crawler, scorpion, buzzard, stalactite, cactus, etc.) are shared; to add e.g. scorpions to Cave, add `"scorpion"` to `DefaultBiome.creatures` (and ensure the default layout options support it). Same idea for obstacles and power-ups: hot-swap by editing the biome’s list.

## Requirements

- **UI:** Biome selector in the menu. Choosing a biome and generating a new level (or loading by seed) produces a level fully styled for that biome. Selection is persisted in localStorage (`dragonBiome`).
- **Level data:** Stored and shared level data includes `biomeId`. Share links may include biome in the hash (e.g. `#seed/difficulty/desert`).
- New biomes must be registered in the same pattern (id, name, assetBasePath, generateLevel, creatures, obstacles, powerUps) and wired into the biome selector and level-load flow.

## References

- [Project Structure](project-structure.md) — asset paths for biomes
- [Biome: Cave](biome-cave.md) — default biome
- [Biome: Desert](biome-desert.md) — desert biome
- [Level Design](level-design.md) — seed, length, goal
