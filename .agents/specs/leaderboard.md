# Leaderboard

> Per-level leaderboard: button, scope, content, and empty state.

## Summary

- **Button:** “Leaderboard” in the menu opens the level leaderboard for the **level currently being played (from the game scene; if no game running, uses selected level in dropdown). Any level ever completed—pack, seed, or random—has a leaderboard**. If “New Random Level” is selected, the user is prompted to select a level first.
- **Scope:** Includes non-default levels (pack, seed-based, random). Display name from `getLevelDisplayName(levelId)`.
- **Content:** List of every completed run for that level: rank, player (userId), score, and time. Sorted by score descending. Only wins are in the list (incomplete runs are never logged).
- **UI:** Overlay panel (same style as win overlay) with close button, level name, and a table. Empty state: “No completed runs yet. Win the level to appear here.”

## Requirements

- Leaderboard shows data for: current game level, or selected level in dropdown if no game running. If selection is “New Random Level”, prompt user to select a level first.
- Display name via `getLevelDisplayName(levelId)`.
- Rows: rank, player (userId), score, time; sorted by score descending; wins only.
- Overlay style matches win overlay; close button; level name; table; empty state text as specified.

## References

- [Score](score.md) — storage and “wins only”
- [UI](ui.md) — overlay style, menu
