# Project Structure

> Where the game lives: entry points, main script, assets, and legacy code.

## Summary

- **Main logic:** `js/game-phaser.js` — single script, no ES modules. Runs from `file://` or a simple static server (including GitHub Pages). Optional PHP/API backends are detected at boot; when absent, all data uses `localStorage`.
- **Engine:** Phaser 3 with Arcade physics.
- **Entry point:** `index.html` loads the game; `css/styles.css` handles layout.
- **Assets:** Shared audio in `assets/audio/`. Biome-specific assets (e.g. Desert) under `assets/biomes/<biomeId>/` (e.g. `assets/biomes/desert/audio/`) so they do not clash with other biomes.
- **Deploy:** GitHub Pages via `.github/workflows/pages.yml` (static artifact only; no server runtime).
- **Legacy:** Code in `legacy/` is kept for reference. Do not rely on it for current behavior.

## Requirements

- Keep the game runnable from `file://` or a static server (no build step required for core play).
- Do not move or split core game logic out of `game-phaser.js` without updating this spec and any references.
- When adding new biomes, follow the same asset pattern: `assets/biomes/<biomeId>/` for that biome’s assets.

## References

- [Biomes](biomes.md) — biome registry and asset paths
- [Audio](audio.md) — asset paths for default and biome audio
