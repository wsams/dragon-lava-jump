# Cheats

> Cheat panel open/close, usage (toggle codes), codes list, and implementation (no score save when used).

## Summary

- **Open:** Press **`** (backtick) or **~** to open the cheat code panel; on mobile/touch devices a **Cheats** button is shown in the menu (visible when `pointer: coarse` or viewport ≤768px). Close with **`** / **~** again or **Escape** or the × button.
- **Usage:** Type a code and press Enter. Run the same code again to **toggle** the cheat off. Using any cheat (on or off) sets `cheatsUsedThisRun` so **scores are not saved** for that run (no `pushScoreForLevel` on win; win overlay shows "Cheats used — score not saved").
- **Codes (lowercase, toggle on/off):**
  - **orb** — Lava orb (replaces other power-ups). Run again to remove.
  - **flame** — Fire totem (replaces other power-ups). Run again to remove.
  - **chomp** — Chomp (Desert only; replaces other power-ups). Run again to remove.
  - **god** — Invincibility: no death from hazards or enemies. Run again to turn off. When on, a gold border is drawn around the screen (fixed UI, `godModeBorder` graphics).
  - **lives** — Infinite lives: lives reset to `LIVES_START` after each death. Run again to turn off.
- **Implementation:** Scene flags `cheatsUsedThisRun`, `cheatInvincible`, `cheatInfiniteLives`. `applyCheat(code)` in `game-phaser.js`; cheat overlay and key handler in same file (DOM). Cheat flags are reset when a new level is loaded (scene create).

## Requirements

- Open/close: backtick/~ and on mobile Cheats button; close with `/~/Escape/×`.
- Codes are lowercase; same code again toggles off.
- Any cheat use (on or off) = `cheatsUsedThisRun` set; no score save on win; win overlay shows “Cheats used — score not saved”.
- Codes: orb, flame, chomp (Desert only), god (gold border when on), lives (infinite). Toggle behavior as specified.
- Implementation: scene flags and `applyCheat(code)` in `game-phaser.js`; cheat UI in same file; flags reset on new level (scene create).

## References

- [Power-ups](power-ups.md) — orb, totem, chomp
- [Score](score.md) — no save when cheats used
- [Lives and Timer](lives-and-timer.md) — lives, god mode
- [UI](ui.md) — win overlay text
- [Technical Notes](technical-notes.md) — game-phaser.js structure
