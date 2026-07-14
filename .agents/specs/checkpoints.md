# Checkpoints

> Two checkpoints per level; activation, respawn, and reset visuals.

## Summary

- **Count:** Exactly 2 per level at 1/3 and 2/3 of the path (platform sequence).
- **Activation:** When you touch a checkpoint, it activates (flag turns golden, sound plays). Only the first touch counts. Uses `checkpoint.mp3` (or `dot.mp3` if checkpoint is missing).
- **Respawn:** On death, respawn at the last checkpoint until you have died 3 times. After 3 deaths, restart from the beginning.
- **Reset visuals:** When the game resets after all lives expired (or on Replay), checkpoint flags and poles must return to their original colors (green flag `0x48bb78`, gray pole `0x718096`). Desert may style checkpoints differently (same logic).

## Requirements

- Exactly 2 checkpoints per level, at 1/3 and 2/3 of platform sequence.
- First touch only activates; golden flag + sound.
- Respawn at last checkpoint until 3 deaths; then restart from start.
- On full reset (all lives lost or Replay), checkpoint visuals reset to default colors.

## References

- [Level Design](level-design.md) — checkpoint placement, replay from start
- [Lives and Timer](lives-and-timer.md) — lives and respawn
- [Audio](audio.md) — checkpoint.mp3, dot fallback
