# Instructions and On-Screen Controls

> How to play overlay and touch control icons (no text labels on buttons).

## Summary

- **Instructions dialog:** An "Instructions" button in the menu opens an overlay (same style as leaderboard) titled "How to play" with **scrollable** content. Text is split into **clear sections** (keyboard, touch, goal, biome hazards, power-ups). The **intro and visible hazard/power-up sections are tailored to the level currently in play** (from the active Phaser `Game` scene: level name, biome, difficulty). Biome-specific sections not relevant to the current run are **hidden** via CSS context classes (`instructions-context-default|desert|ocean` on `#instructionsContentRoot`). `refreshInstructionsForCurrentLevel()` runs when opening the overlay and once after the game boots (`window.__dragonRefreshInstructions`).
- **On-screen control icons:** The touch buttons (Left, Right, Down, Breath, Jump, Boost) use **inline SVG icons only**—no text labels—so that long-press on a button does not trigger OS text selection. Each button keeps an `aria-label` for accessibility. Icons: **Left** = left chevron, **Right** = right chevron, **Down** = down chevron (slam), **Breath** = flame, **Jump** = up chevron, **Boost** = two outward-pointing arrows (← and →). Implemented in `index.html` (SVG inside each button) and `css/styles.css` (`.btn-icon` sizing and button flex centering).

## Requirements

- Instructions: one overlay, “How to play”, **scrollable** body (`.instructions-content` with `min-height: 0` in flex layout), **section headings** and lists where helpful; cover keyboard + on-screen, goal, **per-biome** hazards, power-ups; mention Ocean **swim boost / dash (F)** (cooldown; usable forward surge in water, including near vents) when documenting F.
- Touch buttons: SVG icons only (no text labels); aria-label on each. Icon set as specified (chevrons, flame, double arrows). No text selection on long-press.
- HTML and CSS locations as specified for buttons, icons, and instructions panel layout.

## References

- [Player (Dragon)](player-dragon.md) — controls
- [Player Mechanics](player-mechanics.md) — slam, boost, breath
- [UI](ui.md) — menu, overlay style
- [Biome: Ocean](biome-ocean.md) — swim boost, breath, vents
- [Biome: Cave](biome-cave.md) — Cave hazards text
- [Biome: Desert](biome-desert.md) — Desert hazards text
