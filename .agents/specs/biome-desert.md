# Desert Biome

> Sandy style: cacti, scorpions, buzzards, quicksand; chomp power-up; optional desert audio overrides.

## Summary

- **Style:** Sandy colors (e.g. platform `0xc4a574`, lava/quicksand `0xb8860b`, goal `0xdaa520`). Level layout mostly flat and long; some platforms double or triple length.
- **Obstacles:** Cacti on platforms (3 varieties: saguaro, barrel, needle-shooter). Touching any cactus hurts (death), unless you have the chomp power-up—then you lose chomp, are hurt (shield-loss sound), are bounced back from the cactus, and survive (one touch). Needle-shooter (variety 2): when player is close it “shakes” then shoots 3–4 needles in all directions; needles are dodgeable projectiles; touching a needle kills.
- **Enemies:** Scorpions patrol the ground (platform) back and forth; contact kills unless you have fire totem (kill them) or chomp (front = chomp kill, back/top/bottom = lose chomp, survive). Buzzards: same as scorpions for fire totem and chomp.
- **Layout:** Mostly horizontal, flat platforms; no stalactites; same checkpoints (2) and goal at end, styled for desert. Same 30 dots, lava orb, fire totem, and chomp (Desert-only power-up) mechanics.
- **Dots and cacti:** Dots must not be placed touching or overlapping cacti (so they can be collected). Level generation keeps a clear band around each cactus when placing dots (`CACTUS_AVOID_BAND`).
- **Audio:** Optional overrides in `assets/biomes/desert/audio/`. If a file is present, it is used when playing Desert; if missing, the game uses the Cave sound for that slot. Paths and keys:

## Audio – paths and keys (Desert, optional overrides)

| File | Load path | Key in code |
|------|-----------|-------------|
| `jump.mp3` | `assets/biomes/desert/audio/jump.mp3` | `"desert_jump"` |
| `death.mp3` | `assets/biomes/desert/audio/death.mp3` | `"desert_death"` |
| `shield-loss.mp3` | `assets/biomes/desert/audio/shield-loss.mp3` | `"desert_shieldLoss"` |
| `lava.mp3` | `assets/biomes/desert/audio/lava.mp3` | `"desert_lavaHit"` |
| `breath.mp3` | `assets/biomes/desert/audio/breath.mp3` | `"desert_breath"` |
| `platform-step.mp3` | `assets/biomes/desert/audio/platform-step.mp3` | `"desert_platformStep"` |
| `platform-fall.mp3` | `assets/biomes/desert/audio/platform-fall.mp3` | `"desert_platformFall"` |
| `win.mp3` | `assets/biomes/desert/audio/win.mp3` | `"desert_win"` |
| `music.mp3` | `assets/biomes/desert/audio/music.mp3` | `"desert_music"` |
| `boost.mp3` | `assets/biomes/desert/audio/boost.mp3` | `"desert_boost"` |
| `dot.mp3` | `assets/biomes/desert/audio/dot.mp3` | `"desert_dot"` |
| `checkpoint.mp3` | `assets/biomes/desert/audio/checkpoint.mp3` | `"desert_checkpoint"` |
| (optional) `chomp.mp3` | `assets/biomes/desert/audio/chomp.mp3` | `"desert_chomp"` |
| (optional) `cactus.mp3` | `assets/biomes/desert/audio/cactus.mp3` | `"desert_cactus"` |
| (optional) `scorpion.mp3` | `assets/biomes/desert/audio/scorpion.mp3` | `"desert_scorpion"` |
| (optional) `buzzard.mp3` | `assets/biomes/desert/audio/buzzard.mp3` | `"desert_buzzard"` |

## Requirements

- Colors: platform, lava/quicksand, goal as specified (sandy palette).
- Cacti: 3 varieties; touch = death unless chomp (then lose chomp, shield sound, bounce, survive). Needle-shooter: shake then 3–4 needles; needles = death. The flame breath can burn the cacti. There should be a short animation of them sizzling and going up in smoke and going poof and disappearing.
- Scorpions: patrol platform; fire totem kills; chomp front = kill, back/top/bottom = lose chomp, survive.
- Buzzards: same rules as scorpions.
- Dots: no overlap with cacti; use CACTUS_AVOID_BAND in placement.
- Desert audio: optional overrides in `assets/biomes/desert/audio/`; fallback to default.

## References

- [Biomes](biomes.md) — registry, entity lists
- [Power-ups](power-ups.md) — chomp (Desert only)
- [Player Mechanics](player-mechanics.md) — fire breath
- [Level Design](level-design.md) — checkpoints, dots, goal
- [Audio](audio.md) — fallbacks, console, one music track
