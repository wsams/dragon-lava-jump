# UI

> HUD, menu controls, biome/level/difficulty selects, mute, win screen, buttons, header style, tooltips, player name.

## Summary

- **HUD:** Must show time, best time, dots, lives, level, flame (fire breath), lava (orb uses left). Keep it readable and complete.
- **Biome select:** Dropdown for biome (e.g. Cave, Desert). Persisted. New/random level and seed-based load use selected biome.
- **Level select:** Dropdown for built-in levels (Cave pack). Changing levels should load the correct level.
- **Previously played:** Dropdown for recently completed levels.
- **Difficulty:** Dropdown for difficulty (affects level generation).
- **Mute buttons:** Separate SFX and music toggles. Must persist. SFX affects all sounds except `music.mp3`; music toggle affects `music.mp3` only.
- **Win screen:** Time, dots, best, and buttons. Fade in after the win animation.
- **New level:** Button to start a new random level (uses selected biome).
- **Restart:** Button to restart the current level from the beginning (same as Replay; useful e.g. when stuck in lava with god mode). Hides win overlay and calls `startOrRestartGame()` so the same level reloads.
- **Share:** Button to share the current level (seed/difficulty and biome when desert).
- **Instructions:** Menu button opens the "How to play" overlay — **scrollable** panel, **sectioned** copy (keyboard, goal, per-biome notes), not one unstructured paragraph (see [Instructions and Controls](instructions-and-controls.md)).
- **Sandbox direction:** The game may evolve toward a sandbox/creative-style environment (e.g. Minecraft-style creative within a level world system). Restart and cheats support this use case.

## Menu Header (Dark Mode)

- Keep the menu bar compact and dark-mode friendly. Buttons and selects use dark gray (`#374151`) background with light gray (`#d1d5db`) text. Use common symbols where possible:
  - Share: ⤴ symbol (with `aria-label="Share"`). On copy success, flash magenta glow style; do not change the button text (avoids layout shift).
  - Music: 🔊♪ when on, 🔇♪ when muted
  - SFX: 🔊 FX when on, 🔇 FX when muted
  - New level: short label (e.g. "New")
- Keep padding compact (4–6px), small gaps. Do not revert to light buttons or long text labels.

## Tooltips and Player Name

- **Tooltips:** All menu buttons and selects must have `title` attributes for hover tooltips.
- **Player name:** No "Player:" label in the header. Display the username in a pill design (rounded, dark background). When editing, show input + Save only. Input should also be pill-shaped.

## Requirements

- HUD: time, best time, dots, lives, level, flame, lava (orb uses); readable and complete.
- All dropdowns and buttons as listed; persistence for biome, difficulty, mute.
- Win screen: time, dots, best, buttons; fade in after win animation.
- Restart = same as Replay (from beginning); hide win overlay; call `startOrRestartGame()`.
- Share: include seed/difficulty and biome when desert.
- Menu: dark mode style, symbols, compact padding; tooltips on all controls; player name as pill, no “Player:” label.

## References

- [Biomes](biomes.md) — biome selector persistence
- [Score](score.md) — best, HUD
- [Lives and Timer](lives-and-timer.md) — lives in HUD
- [Instructions and Controls](instructions-and-controls.md) — Instructions button
- [Audio](audio.md) — mute toggles
- [Technical Notes](technical-notes.md) — localStorage keys
