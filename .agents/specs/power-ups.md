# Power-ups

> Lava orb, fire totem, and chomp (Desert only). One at a time; pickup replaces current.

## Summary

- **One at a time:** Picking up a power-up **replaces** the current one (if any). You can only have one of lava orb, fire totem, or chomp (chomp is Desert only). This allows distinct dragon colors/effects per power-up.
- **Lava orb:** Lets you bounce off lava/quicksand instead of dying. Use limit: 3 lava touches total, then orb is lost. Also lost when hit by slime or crawler (Cave) (shield loss). Dragon: **amber/gold blink** while you have it. Uses `shield-loss.mp3` when lost on hit.
- **Fire totem:** Grants 1 fire breath (G). Kills slimes and crawlers (Cave). Lost when you use it or when hit by slime/crawler (shield loss). Dragon: **solid orange** while you have it. Uses `breath.mp3` when firing, `shield-loss.mp3` when lost on hit.
- **Chomp (Desert only):** Collect the chomp power-up to gain long teeth and chomp creatures. Dragon blinks **yellow and green** and shows two long teeth in front. **Front contact** with a scorpion or buzzard: you chomp them (kill, no damage); uses `chomp.mp3`. **Contact from behind, top, or bottom** (or jumping into a cactus): you lose chomp and take no damage (one “shield” touch—creature is not killed). Needles still kill. Picking up chomp replaces lava orb/fire totem; picking up orb/totem replaces chomp. Uses `chomp.mp3` when chomping, `shield-loss.mp3` when losing chomp on wrong-side or cactus touch.
- **Item pickup:** Orb, totem, and (in Desert) chomp are visible items. Picking one up activates it and clears the other (one power-up at a time). No pickup sound.

## Requirements

- Only one active power-up; any new pickup replaces the current one.
- Lava orb: 3 lava bounces then lost; lost on slime/crawler hit (Cave); dragon amber/gold blink.
- Fire totem: one breath (G); lost on use or slime/crawler hit; dragon solid orange.
- Chomp: Desert only; front = chomp kill (scorpion/buzzard); back/top/bottom or cactus = lose chomp, survive; needles still kill; dragon yellow/green blink + teeth.
- No sound on power-up pickup.

## References

- [Player (Dragon)](player-dragon.md) — color and trail for each power-up
- [Player Mechanics](player-mechanics.md) — fire breath (G)
- [Biome: Cave](biome-cave.md) — slime, crawler
- [Biome: Desert](biome-desert.md) — scorpion, buzzard, cactus
- [Level Design](level-design.md) — power-up placement
- [Audio](audio.md) — shield-loss, breath, chomp
