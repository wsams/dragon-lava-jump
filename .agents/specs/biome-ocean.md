# Ocean Biome (strict spec)

> **Intent:** Ocean must feel **fundamentally different** from Cave and Desert—not a reskin of the same platform layouts. The fantasy is **swimming through** a coral-filled world (think *Super Mario Bros.* first water stage), with readable hazards, air pressure, and surface danger—not a flat “run along the top to the goal” level.

This document is **normative** for Ocean implementation and QA. If behavior or art conflicts with Cave/Desert defaults, **Ocean wins here**.

---

## Design pillars (non‑negotiable)

1. **Water volume first** — Most traversal is **open swim** through water decorated with coral, seagrass, and structure—not long stretches of generic rectangular platforms copied from other biomes.
2. **Surface is not a highway** — The **water surface** is a **boundary**, not a solid ground layer the player can **run along to the exit**. Brief surfacing for air is allowed; **sky is visible above** the surface.
3. **Air is a resource** — Manage breath with **surface bobbing**, **air canisters**, and meter; **no lava orb** in Ocean (see exclusions).
4. **Readable hazards** — Bubble shafts **must** pull you **clearly toward the floor hole** (not negligible), but **not** at “vise grip” strength—see [Hazards: vents](#hazards-vents--bubble-shafts). Enemies and props have **distinct silhouettes and colors** (neon urchins, pink jellies, needle barracuda, sky seagulls).

---

## World geometry & boundaries

### Water surface, sky, and “no run‑to‑end” bug

- **Bug (current):** A continuous **ground‑like band** at the top lets the player **stand and run** to the goal, bypassing underwater challenge and **blocking return** to dots below.
- **Required fix:**
  - The **top of the playable water column** is the **water surface** (interface between water and air). **Above** that line, render **blue sky** (day palette: light blue gradient, optional clouds).
  - The player may **bob the head above** the surface briefly to **refill breath** (see breath rules). They must **not** be able to **walk or sprint on the surface** as if it were terrain.
  - **Do not** implement a full‑width solid “ceiling platform” or “ice shelf” that acts as a floor for the whole level. Any surface collision must be **local** (e.g. short kelp rafts, wreck snippets) and **layout must always allow diving back down** toward dots and the main path (see vertical traversal).

### Ocean floor

- The **bottom** may be sand/rock **floor** with vents, coral masses, and props—but the **primary loop** is **swim path through water**, not “hop along platforms.” Floor pieces support navigation and hazards; they are not a copy of Cave’s platform ladder.

### Vertical traversal (surface stuck / dots)

- **Bug (current):** Surfacing **traps** the player until they reach the far side; **dots underwater become unreachable**.
- **Required:** Level generation and collision must guarantee:
  - **Multiple ways to leave the surface band** (swim down freely, drop through gaps, or leave via currents)—**never** a single thin air layer that blocks downward movement for long horizontal spans.
  - **Dots and critical path** must remain **reachable** from both deep water and mid‑depth; QA: “Can I surface for air and still return to any dot without soft‑locking?”

---

## Player movement & physics

### In water (submerged)

- **Feel target:** **James Pond–style** swim: **continuous, natural**, not “Cave double jump pasted underwater.”
- **Separate concerns:**
  - **Horizontal swim** — facing + input gives smooth acceleration and drift; release does not snap to zero.
  - **Upward propulsion** — Dedicated swim‑up behavior (e.g. repeated **stroke** or **angled boost**), **not** the same as Cave’s **double jump** framed as swim. Documented name in code may differ; **player‑facing feel** must be “swim,” not “second jump.”
  - **Downward** — Gravity‑like sink, slam, or downward swim; **float** should still feel watery (**slow** passive drift down, gentle buoyancy bias as appropriate). **Implementation:** `OCEAN_BUOYANCY_MAX_FALL` / `OCEAN_BUOYANCY_UP_BIAS` in `game-phaser.js` — passive sink should **not** feel like fast sinking; tune slower rather than arcade‑heavy.

### At / above the water surface (air pocket or breach)

- **Bug fix:** Once **out of the water** (body largely in air), **disable Cave‑style double jump** and any move that **climbs unrealistically into empty sky**. Surface behavior should be **minimal**: bob, gasp for air, maybe a **short hop** only if it matches real water exit (optional); **no** chaining air jumps to scale the skybox.

### Boost & slam

- **Slam (Down in air)** — May remain where applicable; must be **tuned for water** so it doesn’t replace swim or break surface rules.
- **Swim boost (F) — feature:** While **submerged**, **F** performs a **short forward swim burst** in the **facing** direction (same key as land boost). **Feel target:** *Breath of the Wild* / *Tears of the Kingdom* **Zora suit** — a clear **dash** in the water, not a weak nudge. Uses a **cooldown** (separate from the **air** boost’s “once per jump” rule). Lets the player **escape** barracuda pressure or **cross** bubble-column pull zones. **Implementation order:** the burst impulse is applied **after** bubble-column / vent velocity is computed so the **current** does not overwrite the dash (`OCEAN_SWIM_BOOST_POWER_H` in `game-phaser.js`). **Not** available for “climbing” in the sky above the surface (surface/air rules unchanged).

---

## Air & breath

- **Breath meter** — While **submerged**, meter drains; at **zero** → **drown** (death). HUD stays readable.
- **Refill at surface** — Breaching so the mouth can reach **air** refills meter (full or partial per balance).
- **Feature: air canisters** — **Collectible canisters** placed **throughout the level** restore a **chunk of air** (or full refill—balance). They are the **primary** planned pickup for air besides surfacing; **no lava orb** in Ocean.

---

## Exclusions (Ocean does not include)

- **Lava orb** — **Not** spawned, **not** in `powerUps`, **not** in migration/saves for Ocean.
- **Fire totem / flame breath (G)** — Already excluded; keep excluded.
- **Reusing Cave/Desert platform kits as the main layout** — Avoid long chains of identical rectangular platforms; replace with coral/seagrass/wreck language (see environment).

---

## Hazards: vents & bubble shafts

- **Pull power band (normative):**
  - **Minimum (bug):** Suction **too weak** to draw you into the hole—e.g. buoyancy/clamps canceling the current, or a kill zone you can never satisfy—is a **bug**. The column must **reliably** lead to the hole once you’re in it (implementation: skip buoyancy in the shaft, body‑overlap kill zone at the mouth—see code).
  - **Maximum (feel):** Pull must **not** feel like an overpowering **vise** or instant rail into the hole. **Target:** global vent acceleration roughly **≤ ~50%** of the old “maximum debug” tuning at the same geometry (implementation: `OCEAN_VENT_PULL_MULT` and per‑frame radial cap in `game-phaser.js`). It should still read as a **dangerous current**, not a gentle drift.
  - **Ramp (horizontal):** Strength should **increase toward the column center** (clearer commitment near the shaft core).
  - **Ramp (vertical):** Pull **must be much weaker near the top** of the column (high above the floor hole) and **ramp up** as the player **descends toward the hole** — same shaft should feel **escapable** at the top with swim + steering, **committing** near the mouth. **Implementation:** `OCEAN_VENT_DEPTH_BLEND_PX` + vertical blend factor (see `game-phaser.js` vent block); **do not** use uniform full strength from the water surface down.
- **Bug fix — width:** The shaft’s hazard/pull volume must be **wider than the dragon’s body** (clear margin), so the player cannot trivially slip past the edge; exact multiplier is implementation‑tuned but **minimum: body width + margin** (document in code as constants).
- **Floor hole vs column width:** The **dark floor opening** at the bottom of each bubble column must be **as wide as the column** (same horizontal span as the shaft / pull zone), not a tiny circle—readability and fairness: if you’re in the column, you’re over the hole.
- **Black-hole suction:** Inside the column, the current **pulls the player toward the hole** (radial inward + down‑current). When tuning “escape” or swim‑boost outs, **do not** reintroduce the **too‑weak** bug above; adjust **mult/cap** within the power band instead of deleting the pull path.
- **Death — bug fix (feel):** **Do not** kill on first overlap. When the player is drawn into the **kill zone** at the hole mouth (aligned with the wide opening), play a **goal‑like shrink‑into target** animation (move toward hole center, scale to zero, spin), then apply **death** when the tween **completes** (“fully sucked in”). Until then, **bubbles / current** audio may continue during the pull.

---

## Enemies & surface threat

### Seagulls (feature)

- **Sky above the water** contains **seagulls** (simple bird silhouettes; light/white against blue).
- When the **player surfaces for air**, **seagulls react**: they **swoop toward** the player’s surface position (attack or pressure—**instant kill on contact** unless you later add a dodge rule).
- **Swoop feel:** Swoop uses **acceleration** toward the player up to a **capped max speed** (not instant “warp” speed). **Caps are intentionally low** (on the order of **single‑digit pixels per second** at base scale, ramping slightly by level)—seagulls should feel threatening, not like railgun projectiles. **Patrol** drift along the sky should be **slow**—readable horizontal motion, not frantic skating.
- **Count / difficulty:** **More seagulls** and/or **slightly higher swoop caps / acceleration** on **higher difficulty** (scaled with level difficulty parameter).

### Barracuda (visual & behavior)

- **Art:** **Shimmering blue‑silver**, **needle‑like**: **longer** body, **narrower** top‑to‑bottom (thin profile), not a chunky rectangle.
- **Readable eyes:** Small **eyes** on the head so the player can tell where the fish is “looking.”
- **Two‑part body (swivel):** The fish is built as at least **two segments** (e.g. **tail / main body** + **head / snout**) so the **head can swivel slightly** relative to the tail while swimming—enough to suggest steering toward prey without a full second skeleton.
- **Behavior (tuning / bug fix):** Pursuit must **not** be infinite range. Implement an **aggro / view distance**:
  - **Aggro radius** — The barracuda only **notices** the player (linger / wind‑up to lunge) when the player is **within** this distance.
  - **De‑aggro / break pursuit radius** — If the player moves **beyond** this distance (larger than aggro, with hysteresis), the barracuda **stops homing** and returns to **patrol / wander** until the player enters aggro again.
- **Level tuning (explicit):** Barracuda pursuit speed is **compressed by level** so **Level 1 is easier** and **Level 30 is only a little harder** than Level 1:
  - **Level 1** uses barracuda speed scale `0.45`.
  - **Level 30** uses barracuda speed scale `0.52` (about `1.16x` vs Level 1).
- **Charge:** When committing to a lunge, **orient** so the **nose points** at the dragon; **patrol + lunge** difficulty scales with level, but **must respect** aggro/de‑aggro so barracudas are not oppressively intense across the whole map.

### Jellyfish

- **Art:** **Not** plain squares—**cuter**, **pink** (or pink‑purple), soft bell shape, short tentacles or rounded lobes; readable at small size.

### Sea urchins

- **Art:** **Neon** highlights (e.g. magenta/cyan spikes on dark core), **spiky** silhouette; must pop against background.

---

## Environment art & level shape

- **Direction:** Fill the world with **coral**, **seagrass**, **rock arches**, **sand patches**, **wreck bits**—props that read **underwater** rather than Cave purple slabs or Desert adobe.
- **Layout:** **SMB1 water stage** inspiration: **wide swim corridors**, occasional tight gaps, vertical shafts, and **readable** hazard lanes—**not** a staircase of identical platforms.
- **Dots & goal** — Placed for **swim‑first** routing; checkpoints/goal remain biome‑styled.

---

## Audio (optional overrides)

| File | Load path | Key in code |
|------|-----------|-------------|
| `jump.mp3` | `assets/biomes/ocean/audio/jump.mp3` | `"ocean_jump"` |
| `death.mp3` | `assets/biomes/ocean/audio/death.mp3` | `"ocean_death"` |
| `shield-loss.mp3` | `assets/biomes/ocean/audio/shield-loss.mp3` | `"ocean_shieldLoss"` |
| `breath.mp3` | `assets/biomes/ocean/audio/breath.mp3` | `"ocean_breath"` |
| `breath-low.mp3` | `assets/biomes/ocean/audio/breath-low.mp3` | `"ocean_breathLow"` |
| `bubble-shaft.mp3` | `assets/biomes/ocean/audio/bubble-shaft.mp3` | `"ocean_bubbleShaft"` |
| `platform-step.mp3` | `assets/biomes/ocean/audio/platform-step.mp3` | `"ocean_platformStep"` |
| `platform-fall.mp3` | `assets/biomes/ocean/audio/platform-fall.mp3` | `"ocean_platformFall"` |
| `win.mp3` | `assets/biomes/ocean/audio/win.mp3` | `"ocean_win"` |
| `music.mp3` | `assets/biomes/ocean/audio/music.mp3` | `"ocean_music"` |
| `boost.mp3` | `assets/biomes/ocean/audio/boost.mp3` | `"ocean_boost"` |
| `dot.mp3` | `assets/biomes/ocean/audio/dot.mp3` | `"ocean_dot"` |
| `checkpoint.mp3` | `assets/biomes/ocean/audio/checkpoint.mp3` | `"ocean_checkpoint"` |
| (optional) `baracuda.mp3` | `assets/biomes/ocean/audio/baracuda.mp3` | `"ocean_baracuda"` |
| (optional) `jellyfish.mp3` | `assets/biomes/ocean/audio/jellyfish.mp3` | `"ocean_jellyfish"` |
| (optional) `urchin.mp3` | `assets/biomes/ocean/audio/urchin.mp3` | `"ocean_urchin"` |
| (optional) `seagull.mp3` | `assets/biomes/ocean/audio/seagull.mp3` | `"ocean_seagull"` |

Add **`seagull`** / **`ocean_seagull`** when implementing seagulls; until then missing audio falls back per global rules.

---

## QA checklist (Ocean)

- [ ] No full‑width **run‑along‑top** path to goal; sky visible above surface.
- [ ] Surfacing does **not** soft‑lock; player can **return deep** to collect dots.
- [ ] **No** lava orb; **air canisters** exist and are useful.
- [ ] Bubble shafts: **wide enough**; **floor hole** mouth **matches column width**; **black‑hole style** pull toward the hole + down‑current in the **spec power band** (hole reachable, **not** “vise grip”); death only after **shrink‑into‑hole** animation (not instant on overlap).
- [ ] **Swim boost (F)** underwater: **forward dash** feel + **cooldown**; still effective **inside** bubble columns (not overwritten by vent pass); helps vs currents and threats.
- [ ] **No** double‑jump climbing in **air** above water.
- [ ] Swim feels **swim‑like**, not Cave double jump.
- [ ] Urchins **neon + spiky**; jellyfish **pink + cute**; barracuda **needle + silver‑blue**, **eyes + two‑part swivel**, **aggro / de‑aggro radii** (no map‑wide pursuit); seagulls **swoop on surface**, scale with difficulty.

---

## How to run this spec (“poor man’s spec kit”)

Suggested order for implementation passes (each pass should be shippable / testable):

1. **World boundaries** — Water surface + sky band; remove/replace any **top solid runway**; fix **downward** leave from surface.
2. **Physics** — Submerged swim model vs **air** rules; disable illegal air jumps at surface.
3. **Hazards** — Vent pull **mult + radial cap** (power band: not toothless, not vise) + shaft width.
4. **Air systems** — Remove orb; add **canisters**; tune meter vs surface vs pickups.
5. **Enemies** — Seagulls + barracuda behavior/orientation; then jellyfish/urchin art passes.
6. **Environment** — Coral/seagrass/props and layout variety (de‑platform‑ify).

Keep a **single checklist section** (above) updated as items land. For larger teams, one **tracking issue per bullet** in the checklist works well.

---

## References

- [Biomes](biomes.md) — registry, entity lists  
- [Power-ups](power-ups.md) — global rules (Ocean overrides: no orb)  
- [Player Mechanics](player-mechanics.md) — movement  
- [Lives and Timer](lives-and-timer.md) — breath, drowning  
- [Level Design](level-design.md) — dots, checkpoints, goal  
- [Audio](audio.md) — fallbacks  
