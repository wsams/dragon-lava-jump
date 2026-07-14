# Default Biome (Cave)

> Cave/dungeon style: stalactites, lava, falling platforms, slimes, bats, crawlers.

## Summary

- **Obstacles:** Stalactites (ceiling hazards, touch = death; `death.mp3`). Lava (instant death unless lava orb; `lava.mp3` on death). Falling platforms (drop when you step on them; respawn on death; `platform-step.mp3`, `platform-fall.mp3`).
- **Enemies:** Slime (jumps on platforms; contact kills unless fire breath; fire breath kills slime; `slime.mp3`, `shield-loss.mp3`, `death.mp3`). Bat (flying; contact kills; no shield; `bat.mp3`, `death.mp3`). Crawler (moves around platform edges; same as slime re fire breath; `crawler.mp3`, `shield-loss.mp3`, `death.mp3`).
- **Layout:** Dungeon-style segments. Dynamic world height; ceiling and floor change. Segments: right → up/down → right → up/down → … with a final right segment. Up segments climb into tall shafts; down segments descend into deep pits. World height from platform bounds (lowest platform bottom + 120 px), at least 360 px.
- **Audio:** All under `assets/audio/`. Do not remove or rename without updating load calls. Paths and keys:

## Audio – paths and keys (Cave)

| File | Load path | Key in code |
|------|-----------|-------------|
| `jump.mp3` | `assets/audio/jump.mp3` | `"jump"` |
| `death.mp3` | `assets/audio/death.mp3` | `"death"` |
| `shield-loss.mp3` | `assets/audio/shield-loss.mp3` | `"shieldLoss"` |
| `lava.mp3` | `assets/audio/lava.mp3` | `"lavaHit"` |
| `bat.mp3` | `assets/audio/bat.mp3` | `"batChitter"` |
| `crawler.mp3` | `assets/audio/crawler.mp3` | `"crawlerSlide"` |
| `slime.mp3` | `assets/audio/slime.mp3` | `"slimeJump"` |
| `breath.mp3` | `assets/audio/breath.mp3` | `"breath"` |
| `platform-step.mp3` | `assets/audio/platform-step.mp3` | `"platformStep"` |
| `platform-fall.mp3` | `assets/audio/platform-fall.mp3` | `"platformFall"` |
| `win.mp3` | `assets/audio/win.mp3` | `"win"` |
| `music.mp3` | `assets/audio/music.mp3` | `"music"` |
| `boost.mp3` | `assets/audio/boost.mp3` | `"boost"` |
| `dot.mp3` | `assets/audio/dot.mp3` | `"dot"` |
| `checkpoint.mp3` | `assets/audio/checkpoint.mp3` | `"checkpoint"` |
| `chomp.mp3` | `assets/audio/chomp.mp3` | `"chomp"` (used when chomping in Desert) |

## Requirements

- Stalactites: ceiling hazard; touch = death.
- Lava: instant death unless lava orb; lava sound on death.
- Falling platforms: step = drop; respawn on death; step and fall sounds.
- Slime: platform jumper; contact kills unless fire breath; fire breath kills; slime, shield-loss, death sounds.
- Bat: flying; contact kills; no shield.
- Crawler: platform edges; same as slime for fire breath and shield.
- Layout: right/up/down segments; world height from platform bounds (lowest + 120 px), min 360 px.

## References

- [Biomes](biomes.md) — registry, entity lists
- [Power-ups](power-ups.md) — lava orb, fire totem
- [Player Mechanics](player-mechanics.md) — fire breath
- [Level Design](level-design.md) — dots, checkpoints, stalactite avoid band
- [Audio](audio.md) — fallbacks, console, one music track
