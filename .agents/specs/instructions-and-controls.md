# Instructions and On-Screen Controls

> How to play overlay and touch control icons (no text labels on buttons).

## Summary

- **Instructions dialog:** An "Instructions" button in the menu opens an overlay (same style as leaderboard) titled "How to play" with the full controls (keyboard and on-screen), goal, and biome-specific hazards (Cave vs Desert). Use this as the single in-game source for control and goal text; the page footer shows only repo and Phaser acknowledgements.
- **On-screen control icons:** The touch buttons (Left, Right, Down, Breath, Jump, Boost) use **inline SVG icons only**—no text labels—so that long-press on a button does not trigger OS text selection. Each button keeps an `aria-label` for accessibility. Icons: **Left** = left chevron, **Right** = right chevron, **Down** = down chevron (slam), **Breath** = flame, **Jump** = up chevron, **Boost** = two outward-pointing arrows (← and →). Implemented in `dragonlavajump.html` (SVG inside each button) and `css/styles.css` (`.btn-icon` sizing and button flex centering).

## Requirements

- Instructions: one overlay, “How to play”, full controls (keyboard + on-screen), goal, Cave vs Desert hazards. Footer = repo + Phaser only.
- Touch buttons: SVG icons only (no text labels); aria-label on each. Icon set as specified (chevrons, flame, double arrows). No text selection on long-press.
- HTML and CSS locations as specified for buttons and icons.

## References

- [Player (Dragon)](player-dragon.md) — controls
- [Player Mechanics](player-mechanics.md) — slam, boost, breath
- [UI](ui.md) — menu, overlay style
- [Biome: Cave](biome-cave.md) — Cave hazards text
- [Biome: Desert](biome-desert.md) — Desert hazards text
