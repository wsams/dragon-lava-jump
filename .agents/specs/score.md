# Score

> Points per action, run score, storage per level per user, and HUD display.

## Summary

- **Points:** Dots (10), creature kills (25), power-ups (50), win (100). All values are scaled by difficulty: `1 + (difficulty - 1) * SCORE_DIFFICULTY_FACTOR` so harder levels award more points per action.
- **Run score:** Tracks during the run; resets when you restart from the beginning (all lives lost). Respawn at checkpoint keeps current score.
- **Storage:** Scores are stored per level per user in `dragonScores` (localStorage). User is `getProfileUsername()` or `"anonymous"` if not set. **Only completed (won) runs are logged;** incomplete runs are not stored. Each win appends `{ score, time }` to that level’s list for that user. Best score for a level is the max score in that list.
- **HUD:** Shows current Score, Best score (for this level + user), Time, Dots, Lives. Win overlay shows Score, Best score, Time, Dots.

## Requirements

- Point values and difficulty scaling as specified; do not change without updating this spec.
- Run score resets only on full restart (all lives lost); checkpoint respawn keeps score.
- Only wins are stored; best = max score in that level’s list for that user.
- HUD and win overlay must show Score, Best, Time, Dots; HUD also Lives.

## References

- [Lives and Timer](lives-and-timer.md) — when score resets
- [Leaderboard](leaderboard.md) — uses same stored runs
- [UI](ui.md) — HUD and win overlay
- [Cheats](cheats.md) — cheats used = score not saved
