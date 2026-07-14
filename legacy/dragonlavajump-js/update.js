/**
 * Game update loop: physics, collisions, timers, win/lose. Mutates state.
 */
import { state } from "./state.js";
import {
  LEVEL_LENGTH,
  REFERENCE_FPS,
  gravity,
  moveSpeed,
  jumpStrength,
  POLE_W,
  POLE_H,
  NUM_DOTS,
  DOT_R,
  DOT_MOUTH_HALF_W,
  DRAGON_MOUTH_OVERHANG,
  SLIME_JUMP_STRENGTH,
  BAT_MAX_SPEED,
  BAT_WANDER_STRENGTH,
  CRAWLER_PERIMETER_SPEED,
  TRAIL_LENGTH
} from "./constants.js";
import { applyDeath, crawlerPerimeterPosition } from "./gameFlow.js";
import { loadAllLevels, saveCompletedLevel } from "./storage.js";

function updateSlimes(dt) {
  const { slimes, platforms } = state;
  slimes.forEach(s => {
    if (s.dead) return;
    const p = platforms[s.platformIndex];
    if (!p) return;
    const baseX = p.x + s.offset * p.w - s.w / 2;
    const baseY = p.y - s.h;
    if (s.state === "waiting") {
      s.x = baseX;
      s.y = baseY;
      s.timer -= dt * REFERENCE_FPS;
      if (s.timer <= 0) {
        s.state = "jumping";
        s.vy = -SLIME_JUMP_STRENGTH;
      }
    } else if (s.state === "jumping") {
      s.x = baseX;
      s.vy += gravity * dt;
      s.y += s.vy * dt;
      if (s.y >= baseY) {
        s.y = baseY;
        s.vy = 0;
        s.state = "waiting";
        s.timer = 60 + Math.random() * 120;
      }
    }
  });
}

function updateCrawlers(dt) {
  const { crawlers, platforms } = state;
  crawlers.forEach(c => {
    if (c.dead) return;
    const p = platforms[c.platformIndex];
    if (!p) return;
    c.offset += CRAWLER_PERIMETER_SPEED * dt;
    if (c.offset >= 1) c.offset -= 1;
    const { cx, cy } = crawlerPerimeterPosition(p, c.offset);
    c.x = cx - c.w / 2;
    c.y = cy - c.h / 2;
  });
}

function updateBats(dt) {
  const { bats, W, H } = state;
  const yMin = 80;
  const yMax = H - 80;
  const xMin = 50;
  const xMax = LEVEL_LENGTH - 50;
  bats.forEach(b => {
    b.vx += (b.rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
    b.vy += (b.rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (speed > BAT_MAX_SPEED) {
      b.vx = (b.vx / speed) * BAT_MAX_SPEED;
      b.vy = (b.vy / speed) * BAT_MAX_SPEED;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.x = Math.max(xMin, Math.min(xMax, b.x));
    b.y = Math.max(yMin, Math.min(yMax, b.y));
  });
}

function updateDropPlatforms(dt) {
  const { platforms, currentDifficulty, standingPlatformIndex } = state;
  if (!Array.isArray(platforms) || !platforms.length) return;
  const dClamped = currentDifficulty == null ? 1 : Math.max(1, Math.min(30, currentDifficulty));
  const t = (dClamped - 1) / 29;

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p || !p.drop) continue;
    if (p.dropTimer == null) {
      p.dropTimer = p.drop.delay / REFERENCE_FPS;
      p.dropping = false;
      p.dropActive = false;
    }
    if (standingPlatformIndex === i && !p.dropping) {
      p.dropActive = true;
      if (p.dropTimer > 0) p.dropTimer -= dt;
      if (p.dropTimer <= 0) p.dropping = true;
    }
    if (p.dropping) {
      p.y += p.drop.speed * REFERENCE_FPS * dt;
    }
  }
}

const HITBOX_LEFT_BACKWARD_SHIFT = Math.round(1.5 * (30 + 2 * 6));

export function update(dt) {
  const s = state;
  const {
    dragon, keys, platforms, goal, slimes, crawlers, stalactites, bats,
    checkpointDefs, itemDefs, dotDefs, dotsCollected, lava
  } = s;

  if (s.gameWon) return;

  if (s.lavaBounceTimer > 0) {
    s.lavaBounceTimer -= dt;
    if (s.lavaBounceTimer < 0) s.lavaBounceTimer = 0;
  }

  if (s.isDyingInLava) {
    s.lavaDeathTimer -= dt;
    dragon.y += 36 * dt;
    dragon.vx *= Math.pow(0.9, dt * REFERENCE_FPS);
    dragon.vy = 0;
    if (s.lavaDeathTimer <= 0) applyDeath();
    return;
  }

  if (!s.timerStarted && (keys.left || keys.right || keys.jump || keys.boost || keys.breath)) {
    s.timerStarted = true;
    s.startTime = performance.now();
  }
  if (s.timerStarted) s.currentTime = (performance.now() - s.startTime) / 1000;

  dragon.vx = 0;
  if (keys.left) { dragon.vx = -moveSpeed; dragon.facing = -1; }
  if (keys.right) { dragon.vx = moveSpeed; dragon.facing = 1; }

  if (dragon.onGround) s.timeInAir = 0;
  else s.timeInAir += dt;

  if (keys.jump && dragon.onGround) {
    dragon.vy = -jumpStrength;
    dragon.onGround = false;
    dragon.jumpsLeft = 1;
    s.jumpKeyReleased = false;
  } else if (keys.jump && !dragon.onGround && dragon.jumpsLeft > 0 && s.jumpKeyReleased) {
    dragon.vy = -jumpStrength;
    dragon.jumpsLeft--;
    s.jumpKeyReleased = false;
  }

  const BOOST_AIR_DELAY_SEC = 6 / REFERENCE_FPS;
  const BOOST_DURATION_SEC = 12 / REFERENCE_FPS;
  const BOOST_POWER_H = (64 / 12) * REFERENCE_FPS * REFERENCE_FPS;
  const BOOST_POWER_V = (6 / 12) * REFERENCE_FPS * REFERENCE_FPS;
  const maxUpwardVy = -jumpStrength - 0.5 * REFERENCE_FPS;
  if (keys.boost && !dragon.onGround && dragon.boostAvailable && s.timeInAir >= BOOST_AIR_DELAY_SEC) {
    dragon.boostAvailable = false;
    dragon.boostFramesLeft = BOOST_DURATION_SEC;
  }
  if (dragon.boostFramesLeft > 0) {
    dragon.vx += dragon.facing * BOOST_POWER_H * dt;
    dragon.vy = Math.max(dragon.vy - BOOST_POWER_V * dt, maxUpwardVy);
    dragon.boostFramesLeft -= dt;
  }

  if (keys.breath && !s.breathKeyConsumed && s.fireBreathsLeft > 0 && s.breathActiveTime <= 0) {
    s.breathKeyConsumed = true;
    s.breathActiveTime = 10 / REFERENCE_FPS;
  }

  dragon.vy += gravity * dt;
  updateSlimes(dt);
  dragon.x += dragon.vx * dt;
  dragon.y += dragon.vy * dt;

  const isMoving = Math.abs(dragon.vx) > 30 || Math.abs(dragon.vy) > 30 || dragon.boostFramesLeft > 0;
  if (isMoving) {
    s.dragonTrail.push({ x: dragon.x, y: dragon.y, facing: dragon.facing });
    if (s.dragonTrail.length > TRAIL_LENGTH) s.dragonTrail.shift();
  } else {
    s.dragonTrail = [];
  }

  if (dragon.facing > 0) {
    if (dragon.x < 0) dragon.x = 0;
    if (dragon.x + dragon.w > LEVEL_LENGTH) dragon.x = LEVEL_LENGTH - dragon.w;
  } else {
    if (dragon.x - dragon.w < 0) dragon.x = dragon.w;
    if (dragon.x > LEVEL_LENGTH) dragon.x = LEVEL_LENGTH;
  }
  let dragonLeft = dragon.facing > 0 ? dragon.x : dragon.x - dragon.w;
  let dragonRight = dragon.facing > 0 ? dragon.x + dragon.w : dragon.x;
  if (dragon.facing < 0) {
    dragonLeft += HITBOX_LEFT_BACKWARD_SHIFT;
    dragonRight += HITBOX_LEFT_BACKWARD_SHIFT;
  }

  dragon.onGround = false;
  s.standingPlatformIndex = -1;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (dragonLeft < p.x + p.w && dragonRight > p.x && dragon.y < p.y + p.h && dragon.y + dragon.h > p.y) {
      if (dragon.vy > 0 && dragon.y + dragon.h - dragon.vy * dt <= p.y) {
        dragon.y = p.y - dragon.h;
        dragon.vy = 0;
        dragon.onGround = true;
        dragon.jumpsLeft = 2;
        dragon.boostAvailable = true;
        s.standingPlatformIndex = i;
      }
    }
  }

  for (const sl of slimes) {
    if (sl.dead) continue;
    if (dragonLeft < sl.x + sl.w && dragonRight > sl.x && dragon.y < sl.y + sl.h && dragon.y + dragon.h > sl.y) {
      if (s.fireBreathsLeft > 0) {
        sl.dead = true;
        s.fireBreathsLeft = 0;
        s.fireTotemCollected = false;
      } else applyDeath();
      return;
    }
  }

  updateCrawlers(dt);
  for (const c of crawlers) {
    if (c.dead) continue;
    if (dragonLeft < c.x + c.w && dragonRight > c.x && dragon.y < c.y + c.h && dragon.y + dragon.h > c.y) {
      if (s.fireBreathsLeft > 0) {
        c.dead = true;
        s.fireBreathsLeft = 0;
        s.fireTotemCollected = false;
      } else applyDeath();
      return;
    }
  }

  updateDropPlatforms(dt);

  for (const st of stalactites) {
    const sx = st.x - st.w / 2;
    const sy = st.y;
    const sw = st.w;
    const sh = st.length;
    if (dragonLeft < sx + sw && dragonRight > sx && dragon.y < sy + sh && dragon.y + dragon.h > sy) {
      applyDeath();
      return;
    }
  }

  updateBats(dt);
  for (const b of bats) {
    if (dragonLeft < b.x + b.w && dragonRight > b.x && dragon.y < b.y + b.h && dragon.y + dragon.h > b.y) {
      applyDeath();
      return;
    }
  }

  for (let i = 0; i < checkpointDefs.length; i++) {
    if (i <= s.lastCheckpointIndex) continue;
    const cp = checkpointDefs[i];
    const p = platforms[cp.platformIndex];
    if (!p) continue;
    const poleCenterX = p.x + p.w * cp.offset;
    const poleLeft = poleCenterX - POLE_W / 2;
    const poleTop = p.y - POLE_H;
    if (dragonLeft < poleLeft + POLE_W && dragonRight > poleLeft && dragon.y < p.y && dragon.y + dragon.h > poleTop) {
      s.lastCheckpointIndex = i;
      break;
    }
  }

  if (!s.lavaBounceItemCollected) {
    for (const item of itemDefs) {
      if (item.type !== "lavaBounce") continue;
      if (dragonLeft < item.x + item.w && dragonRight > item.x && dragon.y < item.y + item.h && dragon.y + dragon.h > item.y) {
        s.lavaBounceItemCollected = true;
        s.lavaBounceTimer = 5;
        break;
      }
    }
  }

  if (!s.fireTotemCollected) {
    for (const item of itemDefs) {
      if (item.type !== "fireTotem") continue;
      if (dragonLeft < item.x + item.w && dragonRight > item.x && dragon.y < item.y + item.h && dragon.y + dragon.h > item.y) {
        s.fireTotemCollected = true;
        s.fireBreathsLeft = 1;
        break;
      }
    }
  }

  if (s.breathActiveTime > 0) {
    const breathLen = 50;
    const visualMouthX = dragon.facing > 0 ? dragonRight + DRAGON_MOUTH_OVERHANG : (dragon.x - dragon.w) - DRAGON_MOUTH_OVERHANG;
    const breathEnd = visualMouthX;
    const bx = dragon.facing > 0 ? breathEnd : breathEnd - breathLen;
    const by = dragon.y + 4;
    const bw = breathLen;
    const bh = dragon.h - 8;
    for (const sl of slimes) {
      if (sl.dead) continue;
      if (bx < sl.x + sl.w && bx + bw > sl.x && by < sl.y + sl.h && by + bh > sl.y) sl.dead = true;
    }
    for (const c of crawlers) {
      if (c.dead) continue;
      if (bx < c.x + c.w && bx + bw > c.x && by < c.y + c.h && by + bh > c.y) c.dead = true;
    }
    s.breathActiveTime -= dt;
  }

  const mouthX = dragon.facing > 0 ? dragonRight + DRAGON_MOUTH_OVERHANG : dragonLeft - DRAGON_MOUTH_OVERHANG;
  const dotBoxLeft = mouthX - DOT_MOUTH_HALF_W;
  const dotBoxRight = mouthX + DOT_MOUTH_HALF_W;
  for (let i = 0; i < dotDefs.length; i++) {
    if (dotsCollected[i]) continue;
    const d = dotDefs[i];
    if (dotBoxLeft < d.x + DOT_R && dotBoxRight > d.x - DOT_R && dragon.y < d.y + DOT_R && dragon.y + dragon.h > d.y - DOT_R) {
      s.dotsCollected[i] = true;
      s.dotsCollectedCount++;
    }
  }

  if (dragon.y + dragon.h > lava.y) {
    if (s.lavaBounceTimer > 0) {
      dragon.vy = -18;
      dragon.y = lava.y - dragon.h - 2;
      dragon.onGround = false;
      dragon.jumpsLeft = 1;
      dragon.boostAvailable = false;
    } else {
      s.isDyingInLava = true;
      s.lavaDeathTimer = 35 / REFERENCE_FPS;
      return;
    }
  }

  if (dragonLeft < goal.x + goal.w && dragonRight > goal.x && dragon.y < goal.y + goal.h && dragon.y + dragon.h > goal.y) {
    s.gameWon = true;
    const data = loadAllLevels(s.H);
    const existing = data.levels.find(l => l.id === s.currentLevelID);

    const levelState = {
      H: s.H,
      currentDifficulty: s.currentDifficulty,
      slimeDefs: s.slimeDefs,
      ceilingPoints: s.ceilingPoints,
      stalactiteDefs: s.stalactiteDefs,
      batDefs: s.batDefs,
      itemDefs: s.itemDefs,
      dotDefs: s.dotDefs,
      checkpointDefs: s.checkpointDefs,
      crawlerDefs: s.crawlerDefs,
      currentLevelSeed: s.currentLevelSeed
    };

    if (!existing) {
      const name = prompt("Name this level:");
      if (name) {
        saveCompletedLevel(s.currentLevelID, name, s.platforms, goal, s.currentTime, s.dotsCollectedCount, levelState, s.populateLevelDropdown);
        alert("Level saved!");
      }
    } else {
      saveCompletedLevel(existing.id, existing.name, s.platforms, goal, s.currentTime, s.dotsCollectedCount, levelState, s.populateLevelDropdown);
    }

    if (typeof s.bestScore !== "number" || !isFinite(s.bestScore) || s.currentTime < s.bestScore) {
      s.bestScore = s.currentTime;
    }
    if (typeof s.populateLevelDropdown === "function") s.populateLevelDropdown();
  }

  s.cameraX = dragon.x - s.W / 2;
  if (s.cameraX < 0) s.cameraX = 0;
  if (s.cameraX > LEVEL_LENGTH - s.W) s.cameraX = LEVEL_LENGTH - s.W;
}
