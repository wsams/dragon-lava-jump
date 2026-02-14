# Changelog

All notable changes to Dragon Lava Jump are documented here.

---

## [Unreleased]

### Fixed

- **Fire breath in Desert:** Flame breath (G) and touching scorpions/buzzards with the fire totem now kill scorpions and buzzards in the desert biome, same as slimes/crawlers in the cave. Added `killScorpion` and `killBuzzard`, breath-zone checks for desert creatures, and overlap handlers that consume the totem to survive contact.

### Added

- **Score system:** Points for dots (10), creature kills (25), power-ups (50), and win (100), scaled by difficulty so harder levels award more. Score is shown in the HUD (current + best for level). Scores are stored per level per user in `dragonScores` (localStorage); user is profile username or `"anonymous"`. Only completed (won) runs are logged. Win overlay shows score and best score; level dropdown shows best time, best score, and dots. `addScore()`, `getScoreUserId()`, `loadScores()`, `saveScores()`, `pushScoreForLevel(levelId, userId, score, timeSeconds)`, `getBestScoreForLevel()`, `getLevelLeaderboard(levelId)`.
- **Leaderboard:** “Leaderboard” button in the menu shows an overlay with every completed run for the selected level (rank, player, score, time), sorted by score. Only wins appear; incomplete runs are never stored. Empty state message when no runs. `.cursorrules` updated with Score and Leaderboard sections.
- **Instructions dialog:** Controls and goal text moved from the bottom-of-page legend into an "Instructions" button and overlay dialog (same style as leaderboard). Page footer kept with repo and Phaser acknowledgements only; legend block removed.

- **Slam down:** Hold Down (↓) or S while in the air to drop straight down at a fixed fast speed (Tetris-style). Not instant—uses `SLAM_DOWN_VY` for a quick animation. Use to avoid hazards. Keyboard: ArrowDown, KeyS. Onscreen: horizontal Down button between Left and Right (75% height). Documented in `.cursorrules` Player Mechanics.

- **Biome system**
  - Abstract biome concept: each biome has its own level layout generator and entity set (creatures, obstacles, power-ups).
  - Biome registry in `game-phaser.js`: `BIOMES.default` (Cave) and `BIOMES.desert` (Desert).
  - Level data and build helpers now take or use `biomeId`. `buildLevelDataForNewSeed(seed, difficulty, biomeId)`, `buildLevelDataForRandom(biomeId)`, and `buildLevelDataFromLayout` support both biomes.
  - Stored levels and share links can include `biomeId` (e.g. hash `#seed/difficulty/desert`).

- **Desert biome**
  - New biome "Desert" with sandy colors (platforms, quicksand/lava strip, goal).
  - Level layout: mostly flat, long platforms; some platforms are double or triple length.
  - **Cacti:** Three varieties (saguaro, barrel, needle-shooter) placed on platforms. Touching any cactus hurts (death).
  - **Needle-shooter cactus:** When the player is within range, it triggers then shoots 3–4 needles in all directions; needles are dodgeable projectiles; contact with a needle causes death.
  - **Scorpions:** Ground enemies that patrol back and forth on platforms; contact kills.
  - **Buzzards:** Flying enemies (bat-like movement) in the sky; contact kills.
  - Same rules as Cave for checkpoints (2 at 1/3 and 2/3), goal at end, 30 dots, lava orb, and fire totem (mechanics unchanged; styling differs).

- **UI**
  - Biome selector dropdown in the menu (Cave, Desert). Selection is persisted in localStorage (`dragonBiome`).
  - Share URL includes biome when Desert (e.g. `#seed/diff/desert`). Hash loading parses optional biome and applies it.

- **.cursorrules**
  - Restructured so existing content is under a **Default biome (Cave)** section.
  - New **Biomes** section describes the biome concept, registry, and UI.
  - New **Desert biome** section describes desert layout, cacti (including needle-shooter), scorpions, buzzards, and styling.
  - Project structure updated to mention biome-specific assets under `assets/biomes/<biomeId>/`.
  - Storage key `dragonBiome` documented in Technical Notes.

### Changed

- Level generation is now biome-driven: `DefaultBiome.generateLevel` wraps the existing cave layout; `DesertBiome.generateLevel` produces the flat desert layout with cacti, scorpions, and buzzards.
- Scene create/update/reset branch on `data.biomeId`: default biome creates and updates slimes, bats, crawlers, stalactites; desert creates and updates cacti (and needle projectiles), scorpions, and buzzards.
- Platform, lava, and goal colors are chosen per biome in the scene (and in `resetPlayer` for platform color).
- `buildLevelDataFromStored` and `saveCompletedLevel` include `biomeId` and desert-specific defs (`cactusDefs`, `scorpionDefs`, `buzzardDefs`) where applicable.
- Built-in level pack levels explicitly use `biomeId: "default"`.
- **Default (Cave) layout** now uses `runBiomeGenerators(DefaultBiome, options)` so ceiling/stalactites, slimes, bats, and crawlers come from the same generator registry as desert. Adding a creature to another biome (e.g. scorpion in Cave) is done by adding it to that biome’s `creatures` list.
- **.cursorrules** Biomes section: entity lists (`creatures`, `obstacles`, `powerUps`) and hot-swap behavior documented.

### Audio (Desert fallback and console warnings)

- Desert biome optionally loads sounds from `assets/biomes/desert/audio/` with namespaced keys (`desert_jump`, etc.). If a desert file is **missing**, the game uses the default (Cave) sound for that slot. Levels still load and run with no sound if neither file exists.
- When a sound would play but no file is available, a **console** warning is logged: `[Dragon Lava Jump] Sound not available (missing file): <name>`.
- When a Desert override file fails to load at startup, a console warning is logged: `[Dragon Lava Jump] Desert audio file missing (see .cursorrules for paths): <key>`.
- New helper `playSfx(soundRef, nameForLog, playOptions)` centralizes play and missing-sound logging. `.cursorrules` Audio section documents file names and paths for both Cave and Desert.

### Technical

- Desert constants added: `DESERT_PLATFORM_BASE_Y`, `CACTUS_*`, `NEEDLE_*`, `SCORPION_*`, `BUZZARD_*`.
- Desert entities: cactus hitboxes + graphics (3 varieties), scorpion bodies, buzzard bodies + wings, and a `needleGroup` for needle projectiles. Overlap handlers: `onOverlapCactus`, `onOverlapScorpion`, `onOverlapBuzzard`, `onOverlapNeedle`.
- Needles are created when a needle-shooter cactus fires; they are moved by physics and removed when off-screen or after a short lifetime.

### Fixed

- **Desert dots and cacti:** Dots are no longer placed touching cacti. `generateDots` accepts an optional `cactusDefs`; when provided, a clear band (`CACTUS_AVOID_BAND`) around each cactus is excluded so dots stay collectible. `.cursorrules` Desert biome section updated with "Dots and cacti" rule.
- **Checkpoints and dots away from obstacles:** Checkpoints are no longer placed on platforms that have a slime, cactus, or stalactite above them. Dots already avoided slimes and cacti; they now also avoid the X-band under stalactites (`STALACTITE_AVOID_BAND`). `generateCheckpoints` accepts optional `obstacleOpts: { stalactiteDefs, cactusDefs }`; `generateDots` accepts optional `stalactiteDefs`.
- **Lava orb and fire totem above platforms:** Power-up items are now placed above a chosen platform (lava orb in the middle third of the level, fire totem in the first half) so they are always reachable. When `platforms` is passed to `generateLavaBounceItem(seed, H, platforms)` and `generateFireTotemItem(seed, H, platforms)`, position is `(platform.x + platform.w/2 + wiggle, platform.y - height)`; fallback when no platforms is unchanged.
- **Double jump once per flight:** Double jump is now gated by a single flag `doubleJumpUsedThisFlight` (scene state). It is set to `true` when the player performs a double jump and set to `false` only when landing on a real platform (`physicsGround && standingPlatformIndex >= 0`), on lava bounce, or on respawn. No refill logic or jump count is used for the double-jump gate, so multiple double jumps in one flight are impossible.
- **Jump from platform edge:** Ground detection for jumping uses a lenient platform check: `GROUND_EDGE_TOLERANCE` (12 px) and `GROUND_TOP_TOLERANCE` (10 px) so standing on the very tip of a platform counts as on ground, giving a normal jump plus one double jump instead of the first jump counting as the double jump.
