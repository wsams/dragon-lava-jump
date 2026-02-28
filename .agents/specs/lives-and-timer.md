# Lives and Timer

> Lives per run and when the timer resets.

## Summary

- **Lives:** 3 per run. Lose one on death.
- **Timer:** Runs while you have lives. Resets only when you lose all 3 lives and restart from the beginning. Do not reset the timer when respawning at a checkpoint.

## Requirements

- Exactly 3 lives per run; one lost per death.
- Timer: keep running on checkpoint respawn; reset only on full restart (all 3 lives lost).

## References

- [Checkpoints](checkpoints.md) — respawn vs full restart
- [Score](score.md) — run score reset on full restart
- [UI](ui.md) — HUD lives display
