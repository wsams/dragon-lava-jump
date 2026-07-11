# Technical Notes

> License, constants, physics, storage keys, and backendless / static hosting.

## Summary

- **No license:** This project is not licensed for reuse or distribution. Do not add license files or license sections.
- **Constants:** Physics and layout constants are at the top of `game-phaser.js`. Desert-specific constants (e.g. `CACTUS_*`, `SCORPION_*`, `BUZZARD_*`) are with the biome section. Change them carefully.
- **Physics:** Arcade physics. Player hitbox is fixed; do not tie it to facing direction.
- **Storage:** Levels and progress are saved via `storageGet` / `storageSet`. Keys: `dragonLevels`, `dragonProfile`, `dragonAudio`, `dragonDifficulty`, `dragonBiome`, `dragonScores`.
- **Backend detection:** On boot, `detectBackend()` probes `api/health` and `api/health.php`. If no API responds (GitHub Pages, `file://`, plain static servers), mode is `local` and all persistence uses `localStorage`. Mode is exposed as `window.__dragonBackendMode` (`"local"` | `"remote"`). Override with `?backend=local` or `?backend=remote`.
- **GitHub Pages:** `.github/workflows/pages.yml` builds a static `_site` (html, css, js, assets, `.nojekyll`) and deploys with `actions/deploy-pages`. Pages must be enabled once in repo settings (**Settings → Pages → Source: GitHub Actions**); the default `GITHUB_TOKEN` cannot turn Pages on by itself.

## Requirements

- Do not add license files or license sections to the project.
- When changing physics or layout constants, update this spec or the relevant feature spec if behavior changes.
- Player hitbox: fixed size; not dependent on facing direction.
- localStorage keys: use only the listed keys for the listed purposes; do not introduce new keys without documenting them here or in the relevant spec.
- Static / Pages hosting must remain fully playable with no PHP or server API; localStorage is the default when no backend is detected.

## References

- [Project Structure](project-structure.md) — game-phaser.js
- [Biomes](biomes.md) — dragonBiome
- [UI](ui.md) — persistence (audio, difficulty, biome)
- [Score](score.md) — dragonScores (implied; see leaderboard/score storage)
- Issue [#4](https://github.com/wsams/dragon-lava-jump/issues/4) — backendless / Pages support
