# Dragon Lava Jump – Specs

Specs in this directory describe features and constraints for the game. Use them when implementing or changing behavior.

## Naming

- Files are **lowercase with hyphens**: `biome-cave.md`, `player-mechanics.md`.
- One feature (or closely related set) per file.

## Pattern (per file)

- **Title** (H1) – feature name
- **Summary** – what it is, where it lives, key bullets
- **Requirements** – must/must-not in short form
- **References** – links to other spec files and key code

## Index

| Spec | Purpose |
|------|--------|
| [project-structure](project-structure.md) | Entry points, main script, assets, legacy |
| [biomes](biomes.md) | Biome system, registry, UI, entity lists |
| [player-dragon](player-dragon.md) | Dragon visual, color, trail, controls |
| [player-mechanics](player-mechanics.md) | Jump, slam, boost, fire breath |
| [power-ups](power-ups.md) | Lava orb, fire totem, chomp (one at a time) |
| [checkpoints](checkpoints.md) | Two checkpoints, respawn, reset visuals |
| [level-design](level-design.md) | Seed, length, goal, dots, replay |
| [biome-cave](biome-cave.md) | Cave: stalactites, lava, slimes, bats, crawlers |
| [biome-desert](biome-desert.md) | Desert: cacti, scorpions, buzzards, chomp |
| [score](score.md) | Points, run score, storage, HUD |
| [leaderboard](leaderboard.md) | Per-level leaderboard UI and data |
| [instructions-and-controls](instructions-and-controls.md) | How to play overlay, touch icons |
| [lives-and-timer](lives-and-timer.md) | Lives count, timer reset rules |
| [ui](ui.md) | HUD, menu, dropdowns, mute, win screen, header |
| [audio](audio.md) | Default/Desert paths and keys, fallbacks |
| [cheats](cheats.md) | Cheat panel, codes, no score save when used |
| [technical-notes](technical-notes.md) | License, constants, physics, storage keys |

## Usage

When adding a feature or bug fix: create or update a spec file here, then refer the agent to it (e.g. “read `.agents/specs/audio.md` and fix …”) so implementation follows the spec.
