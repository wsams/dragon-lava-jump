# Audio

> Fallbacks, console warnings, user gesture, and global rules (path/key tables live in biome specs).

## Summary

- **Path/key tables:** Cave audio paths and keys are in [Biome: Cave](biome-cave.md#audio--paths-and-keys-cave). Desert optional overrides are in [Biome: Desert](biome-desert.md#audio--paths-and-keys-desert-optional-overrides).
- **Fallbacks:** If `checkpoint.mp3` is missing (Cave), the dot sound is used. Desert: any slot without a file in `assets/biomes/desert/audio/` uses the Cave sound; if both are missing, no sound plays and the console shows which file is missing.
- **Console:** When a sound would play but no file is available (Cave or Desert), warn: `[Dragon Lava Jump] Sound not available (missing file): <name>`. When a Desert override file fails to load at startup, warn: `[Dragon Lava Jump] Desert audio file missing (see .agents/specs/biome-desert.md for paths): <key>`.
- **User gesture:** Audio may require a user click/tap before playing in some browsers.

## Requirements

- Do not remove or rename default (Cave) files without updating load calls and [Biome: Cave](biome-cave.md).
- Desert overrides: same file names as Cave; missing file = use default for that slot; missing both = no sound + console warning.
- Checkpoint fallback: if checkpoint.mp3 missing, use dot sound.
- Console messages as specified for missing play and load errors.
- Only one biome music track plays at a time when switching levels/biomes (stop previous track before starting new one).

## References

- [Project Structure](project-structure.md) — asset directories
- [Biome: Cave](biome-cave.md) — Cave audio paths and keys
- [Biome: Desert](biome-desert.md) — Desert audio paths and keys
- [UI](ui.md) — mute toggles (SFX vs music)
