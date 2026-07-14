# Player (Dragon)

> Visual representation, color states, motion trail, and control bindings for the player character.

## Summary

- **Visual:** Body rectangle plus separate head (nose) and eye. All must move and scale together (including win animation and lava death fade). No horns or teeth.
- **Color:** Base green; turns orange when lava orb or fire totem active (orb also blinks).
- **Motion trail:** Should appear when moving quickly or boosting. Trail color must match dragon color (green or orange).
- **Controls:** Arrow keys / A,D for move; Space for jump; F for boost; G for fire breath (when totem active).
- **Double jump:** One extra jump in mid-air. A small shimmering purple platform appears where you jump from, is single-use (fall-through after leaving), then fades out.

## Requirements

- Dragon body, head, eye (and win/death visuals) must stay in sync; no detached or scaling-only parts.
- Color and trail must reflect current power-up state (green default; orange/blink for orb/totem; see [Power-ups](power-ups.md) for chomp visuals).
- Control scheme must remain as specified; any new input (e.g. slam down) must be documented in [Player Mechanics](player-mechanics.md) and [Instructions and Controls](instructions-and-controls.md).

## References

- [Player Mechanics](player-mechanics.md) — jump, slam, boost, fire breath behavior
- [Power-ups](power-ups.md) — orb, totem, chomp and their visual/color effects
- [Instructions and Controls](instructions-and-controls.md) — on-screen controls and icons
