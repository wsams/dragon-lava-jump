/**
 * Level loading, reset, and entity building (slimes, bats, crawlers, stalactites).
 */
import { state } from "./state.js";
import { LIVES_START, CRAWLER_W, CRAWLER_H, NUM_DOTS } from "./constants.js";
import {
  generateDefaultLevelLayout,
  generateSlimesForPlatforms,
  generateDots,
  generateCrawlers
} from "./levelGen.js";
import { makeRng } from "./rng.js";
import { DEFAULT_LEVELS } from "./storage.js";

export function crawlerPerimeterPosition(p, t) {
  const tw = p.w;
  const th = p.h;
  if (t < 0.25) return { cx: p.x + (t / 0.25) * tw, cy: p.y };
  if (t < 0.5) return { cx: p.x + tw, cy: p.y + ((t - 0.25) / 0.25) * th };
  if (t < 0.75) return { cx: p.x + tw - ((t - 0.5) / 0.25) * tw, cy: p.y + th };
  const f = (t - 0.75) / 0.25;
  return { cx: p.x, cy: p.y + th - f * th };
}

export function buildSlimesFromDefs() {
  const { platforms, slimeDefs } = state;
  state.slimes = [];
  const slimeW = 22;
  const slimeH = 18;
  slimeDefs.forEach(def => {
    const p = platforms[def.platformIndex];
    if (!p) return;
    const offset = typeof def.offset === "number" ? def.offset : 0.5;
    const baseX = p.x + offset * p.w - slimeW / 2;
    const baseY = p.y - slimeH;
    const initialDelay = typeof def.delay === "number" && def.delay > 0 ? def.delay : 60 + Math.random() * 120;
    state.slimes.push({
      platformIndex: def.platformIndex,
      offset,
      x: baseX, y: baseY, baseX, baseY, w: slimeW, h: slimeH,
      vy: 0, state: "waiting", timer: initialDelay
    });
  });
}

export function buildStalactitesFromDefs() {
  state.stalactites = [];
  state.stalactiteDefs.forEach(def => {
    if (typeof def.x !== "number" || typeof def.y !== "number") return;
    state.stalactites.push({
      x: def.x, y: def.y,
      length: def.length || 40,
      w: def.w || 24
    });
  });
}

export function buildBatsFromDefs() {
  state.bats = [];
  state.batDefs.forEach(def => {
    if (typeof def.x !== "number" || typeof def.y !== "number") return;
    const rngSeed = typeof def.rngSeed === "number" ? def.rngSeed : 0;
    state.bats.push({
      x: def.x, y: def.y, vx: 0, vy: 0,
      w: 24, h: 16,
      rng: makeRng(rngSeed)
    });
  });
}

export function buildCrawlersFromDefs() {
  state.crawlers = [];
  const { platforms, crawlerDefs } = state;
  crawlerDefs.forEach(def => {
    const p = platforms[def.platformIndex];
    if (!p) return;
    const offset = Math.max(0, Math.min(1, def.offset));
    const { cx, cy } = crawlerPerimeterPosition(p, offset);
    state.crawlers.push({
      x: cx - CRAWLER_W / 2, y: cy - CRAWLER_H / 2,
      w: CRAWLER_W, h: CRAWLER_H,
      platformIndex: def.platformIndex, offset
    });
  });
}

export function resetPlayerToStart() {
  const s = state;
  if (Array.isArray(s.basePlatforms) && s.basePlatforms.length) {
    s.platforms = JSON.parse(JSON.stringify(s.basePlatforms));
  }

  let p;
  if (s.lastCheckpointIndex >= 0 && s.checkpointDefs[s.lastCheckpointIndex] && Array.isArray(s.platforms)) {
    const cp = s.checkpointDefs[s.lastCheckpointIndex];
    p = s.platforms[cp.platformIndex];
    if (p) {
      s.dragon.x = p.x + p.w * cp.offset - s.dragon.w / 2;
      s.dragon.y = p.y - s.dragon.h;
    } else {
      p = s.platforms[0];
      s.dragon.x = p.x + p.w / 2 - s.dragon.w / 2;
      s.dragon.y = p.y - s.dragon.h;
    }
  } else {
    p = s.platforms[0];
    s.dragon.x = p.x + p.w / 2 - s.dragon.w / 2;
    s.dragon.y = p.y - s.dragon.h;
  }

  s.dragon.vx = 0;
  s.dragon.vy = 0;
  s.dragon.onGround = true;
  s.dragon.facing = 1;
  s.dragon.boostCooldown = 0;
  s.dragon.jumpsLeft = 2;
  s.dragon.boostAvailable = true;

  buildSlimesFromDefs();
  buildStalactitesFromDefs();
  buildBatsFromDefs();
  buildCrawlersFromDefs();

  s.lavaBounceItemCollected = false;
  s.lavaBounceTimer = 0;
  s.fireBreathsLeft = 0;
  s.fireTotemCollected = false;
  s.breathActiveTime = 0;
  s.breathKeyConsumed = false;
  if (s.lastCheckpointIndex < 0) {
    s.dotsCollected = s.dotDefs.map(() => false);
    s.dotsCollectedCount = 0;
  }
  s.dragonTrail = [];
  s.dragon.boostFramesLeft = 0;
  s.timeInAir = 0;
  s.timerStarted = false;
  s.startTime = 0;
  s.currentTime = 0;
  s.gameWon = false;
  s.isDyingInLava = false;
  s.lavaDeathTimer = 0;
  s.cameraX = 0;
}

export function applyDeath() {
  state.lives--;
  if (state.lives <= 0) {
    state.lastCheckpointIndex = -1;
    state.lives = LIVES_START;
  }
  resetPlayerToStart();
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function generateLevelFromSeed(seed, difficulty) {
  const s = state;
  difficulty = difficulty != null ? Math.max(1, Math.min(30, difficulty)) : 15;
  seed = Math.floor(Number(seed)) || 0;
  if (seed <= 0) return;

  const layout = generateDefaultLevelLayout(difficulty, seed, s.H);
  s.currentLevelID = "seed-" + seed;
  s.currentLevelSeed = seed;
  s.platforms = layout.platforms;
  s.basePlatforms = JSON.parse(JSON.stringify(layout.platforms));
  s.startPlatform = s.platforms[0];
  s.goal = layout.goal;
  s.bestScore = Infinity;
  s.currentDifficulty = difficulty;
  s.slimeDefs = Array.isArray(layout.slimes) ? layout.slimes : generateSlimesForPlatforms(s.platforms, difficulty, seed + 999);
  s.ceilingPoints = layout.ceilingPoints;
  s.stalactiteDefs = layout.stalactites;
  s.batDefs = Array.isArray(layout.bats) ? layout.bats : [];
  s.itemDefs = Array.isArray(layout.items) ? layout.items : [];
  s.dotDefs = Array.isArray(layout.dots) ? layout.dots : generateDots(s.platforms, seed + 444, layout.goal, layout.slimes, layout.crawlers);
  s.dotsCollected = s.dotDefs.map(() => false);
  s.dotsCollectedCount = 0;
  s.checkpointDefs = Array.isArray(layout.checkpoints) ? layout.checkpoints : [];
  s.crawlerDefs = Array.isArray(layout.crawlers) ? layout.crawlers : [];
  s.lastCheckpointIndex = -1;
  s.lives = LIVES_START;
  if (typeof s.syncUrlToSeed === "function") s.syncUrlToSeed();
}

export function generateRandomLevel() {
  const s = state;
  const difficulty = Math.floor(randomRange(8, 23));
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const layout = generateDefaultLevelLayout(difficulty, seed, s.H);

  s.currentLevelID = crypto.randomUUID();
  s.currentLevelSeed = seed;
  s.platforms = layout.platforms;
  s.basePlatforms = JSON.parse(JSON.stringify(layout.platforms));
  s.startPlatform = s.platforms[0];
  s.goal = layout.goal;
  s.bestScore = Infinity;
  s.currentDifficulty = difficulty;
  s.slimeDefs = Array.isArray(layout.slimes) ? layout.slimes : generateSlimesForPlatforms(s.platforms, difficulty, seed + 999);
  s.ceilingPoints = layout.ceilingPoints;
  s.stalactiteDefs = layout.stalactites;
  s.batDefs = Array.isArray(layout.bats) ? layout.bats : [];
  s.itemDefs = Array.isArray(layout.items) ? layout.items : [];
  s.dotDefs = Array.isArray(layout.dots) ? layout.dots : generateDots(s.platforms, seed + 444, layout.goal, layout.slimes, layout.crawlers);
  s.dotsCollected = s.dotDefs.map(() => false);
  s.dotsCollectedCount = 0;
  s.checkpointDefs = Array.isArray(layout.checkpoints) ? layout.checkpoints : [];
  s.crawlerDefs = Array.isArray(layout.crawlers) ? layout.crawlers : [];
  s.lastCheckpointIndex = -1;
  s.lives = LIVES_START;
  if (typeof s.syncUrlToSeed === "function") s.syncUrlToSeed();
}

export function loadLevel(level) {
  const s = state;
  s.currentLevelID = level.id;
  s.currentLevelSeed = level.seed ?? DEFAULT_LEVELS.find(m => m.id === level.id)?.seed ?? null;

  s.platforms = JSON.parse(JSON.stringify(level.platforms));
  s.basePlatforms = JSON.parse(JSON.stringify(level.platforms));
  s.goal = JSON.parse(JSON.stringify(level.goal));
  s.bestScore = level.bestScore;
  s.currentDifficulty = level.difficulty || null;
  s.slimeDefs = Array.isArray(level.slimes) ? level.slimes : [];
  s.ceilingPoints = Array.isArray(level.ceiling) ? level.ceiling : [];
  s.stalactiteDefs = Array.isArray(level.stalactites) ? level.stalactites : [];
  s.batDefs = Array.isArray(level.bats) ? level.bats : [];
  s.itemDefs = Array.isArray(level.items) ? level.items : [];
  s.checkpointDefs = Array.isArray(level.checkpoints) ? level.checkpoints : [];
  s.crawlerDefs = Array.isArray(level.crawlers) && level.crawlers.length > 0
    ? level.crawlers
    : generateCrawlers(level.platforms || s.platforms, level.slimes || s.slimeDefs, level.difficulty != null ? level.difficulty : 15, (level.seed != null ? level.seed : 0) + 555);
  s.dotDefs = Array.isArray(level.dots) && level.dots.length === NUM_DOTS
    ? level.dots
    : generateDots(s.platforms, (level.seed != null ? level.seed : 0) + 444, s.goal, s.slimeDefs, s.crawlerDefs);
  s.dotsCollected = s.dotDefs.map(() => false);
  s.dotsCollectedCount = 0;
  s.lastCheckpointIndex = -1;
  s.lives = LIVES_START;

  resetPlayerToStart();
  if (typeof s.syncUrlToSeed === "function") s.syncUrlToSeed();
}
