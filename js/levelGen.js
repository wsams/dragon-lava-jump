/**
 * Level layout generation (platforms, ceiling, stalactites, bats, slimes, crawlers, dots, items, checkpoints).
 * All functions that need canvas height take H as a parameter.
 */
import { makeRng, rngRange } from "./rng.js";
import {
  LEVEL_LENGTH,
  NUM_DOTS,
  DOT_SAFETY_MARGIN,
  SLIME_AVOID_BAND,
  REFERENCE_FPS
} from "./constants.js";

export function generateCeilingAndStalactites(difficulty, seed, platforms) {
  const rng = makeRng(seed);
  const pts = [];
  const dClamped = Math.max(1, Math.min(30, difficulty));
  const t = (dClamped - 1) / 29;
  const step = 120;
  let x = 0;
  let baseY = 30;
  const amp = 8 + t * 22;

  while (x <= LEVEL_LENGTH) {
    let y = baseY + rngRange(rng, -amp, amp);
    y = Math.max(10, Math.min(70, y));
    pts.push({ x, y });
    baseY = baseY * 0.7 + y * 0.3;
    x += step;
  }

  const stalDefs = [];
  const maxStals = 3 + Math.floor(dClamped / 4);
  const available = pts.slice(1, pts.length - 1);
  for (let i = 0; i < maxStals && available.length > 0; i++) {
    const idx = Math.floor(rng() * available.length);
    const p = available.splice(idx, 1)[0];
    const w = 18 + rng() * 8;
    const lenMin = 18 + t * 6;
    const lenMax = 34 + t * 10;
    let length = rngRange(rng, lenMin, lenMax);

    if (Array.isArray(platforms) && platforms.length) {
      let nearestY = Infinity;
      for (const plat of platforms) {
        if (!plat) continue;
        const withinX = p.x >= plat.x && p.x <= plat.x + plat.w;
        if (!withinX) continue;
        if (plat.y > p.y && plat.y < nearestY) nearestY = plat.y;
      }
      if (nearestY < Infinity) {
        const dragonHeight = 26;
        const mult = 3.0 - 0.5 * t;
        const extraPadding = 16;
        const clearance = dragonHeight * mult + extraPadding;
        const maxAllowed = nearestY - p.y - clearance;
        if (maxAllowed <= dragonHeight) continue;
        length = Math.min(length, maxAllowed);
      }
    }
    stalDefs.push({ x: p.x, y: p.y, length, w });
  }
  return { ceilingPoints: pts, stalactites: stalDefs };
}

export function generateDefaultLevelLayout(difficulty, seed, H) {
  const rng = makeRng(seed);
  const platforms = [];
  const start = { x: 40, y: H - 140, w: 180, h: 16 };
  platforms.push(start);

  const maxPlatforms = 16 + Math.floor(difficulty * 0.7);
  let x = start.x + start.w + 70;
  let baseY = H - 150;
  const gapMin = 90 + difficulty * 4;
  const gapMax = 130 + difficulty * 8;
  const dClamped = Math.max(1, Math.min(30, difficulty));
  const t = (dClamped - 1) / 29;
  const easyMin = 140;
  const easyMax = 220;
  const hardMin = easyMin * 0.5;
  const hardMax = easyMax * 0.5;
  const globalMin = easyMin + (hardMin - easyMin) * t;
  const globalMax = easyMax + (hardMax - easyMax) * t;
  const shortProb = 0.2 + 0.6 * t;
  const shortMin = globalMin * 0.6;
  const shortMax = globalMin;
  const longMin = globalMin;
  const longMax = globalMax * 1.1;
  const vertAmp = 40 + difficulty * 3;

  for (let i = 0; i < maxPlatforms; i++) {
    const gap = rngRange(rng, gapMin, gapMax);
    x += gap;
    if (x > LEVEL_LENGTH - 260) break;
    const useShort = rng() < shortProb;
    const w = useShort
      ? rngRange(rng, shortMin, shortMax)
      : rngRange(rng, longMin, longMax);
    let y = baseY + rngRange(rng, -vertAmp, vertAmp);
    y = Math.max(80, Math.min(H - 180, y));
    const platform = { x, y, w, h: 16 };
    const bendChance = 0.1 + 0.6 * t;
    if (rng() < bendChance) {
      const joint = rngRange(rng, 0.25, 0.75);
      const sign = rng() < 0.5 ? -1 : 1;
      const maxBendPixels = 14;
      const bendHeight = sign * rngRange(rng, 6, maxBendPixels);
      platform.bend = { joint, bendHeight };
    }
    platforms.push(platform);
    baseY = baseY * 0.6 + y * 0.4;
  }

  const dropProbBase = 0.06 + 0.18 * t;
  const maxDroppers = Math.max(1, Math.floor((platforms.length - 2) * (0.08 + 0.2 * t)));
  let dropCount = 0;
  for (let i = 1; i < platforms.length - 1 && dropCount < maxDroppers; i++) {
    const p = platforms[i];
    if (!p || p.y > H - 120) continue;
    if (rng() > dropProbBase) continue;
    p.drop = { delay: 30 + rng() * 45, speed: 2.4 + t * 1.6 };
    dropCount++;
  }

  const last = platforms[platforms.length - 1];
  const goalX = Math.min(LEVEL_LENGTH - 120, last.x + last.w + 80);
  const goal = { x: goalX, y: H - 120, w: 50, h: 80 };

  const cave = generateCeilingAndStalactites(difficulty, seed + 321, platforms);
  const bats = generateBats(difficulty, seed + 777, H);
  const items = generateLavaBounceItem(seed + 888, H).concat(generateFireTotemItem(seed + 999, H));
  const slimes = generateSlimesForPlatforms(platforms, difficulty, seed + 999);
  const checkpoints = generateCheckpoints(platforms, slimes, seed + 111);
  const crawlers = generateCrawlers(platforms, slimes, difficulty, seed + 555);
  const dots = generateDots(platforms, seed + 444, goal, slimes, crawlers);

  return {
    platforms,
    goal,
    ceilingPoints: cave.ceilingPoints,
    stalactites: cave.stalactites,
    bats,
    items,
    dots,
    slimes,
    checkpoints,
    crawlers
  };
}

function pickCrawlerCountForDifficulty(difficulty) {
  if (difficulty <= 5) return 1;
  if (difficulty <= 15) return 2;
  return 3;
}

export function generateCrawlers(platforms, slimeDefs, difficulty, seed) {
  const rng = makeRng(seed);
  const slimePlatforms = new Set((slimeDefs || []).map(s => s.platformIndex));
  const candidates = platforms
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i > 0 && !slimePlatforms.has(i));
  if (!candidates.length) return [];
  const count = Math.min(pickCrawlerCountForDifficulty(difficulty), candidates.length);
  const defs = [];
  const used = new Set();
  for (let n = 0; n < count; n++) {
    let idx = Math.floor(rng() * candidates.length);
    let tries = candidates.length;
    while (used.has(idx) && tries--) idx = (idx + 1) % candidates.length;
    if (used.has(idx)) continue;
    used.add(idx);
    defs.push({ platformIndex: candidates[idx].i, offset: rng() });
  }
  return defs;
}

export function generateCheckpoints(platforms, slimeDefs, seed) {
  const slimePlatformIndices = new Set((slimeDefs || []).map(s => s.platformIndex));
  const candidates = platforms
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i > 0 && !slimePlatformIndices.has(i));
  if (candidates.length < 2) return [];
  const target1 = LEVEL_LENGTH / 3;
  const target2 = (LEVEL_LENGTH * 2) / 3;
  const center = ({ p }) => p.x + p.w / 2;
  const byDist1 = [...candidates].sort((a, b) => Math.abs(center(a) - target1) - Math.abs(center(b) - target1));
  const byDist2 = [...candidates].sort((a, b) => Math.abs(center(a) - target2) - Math.abs(center(b) - target2));
  let idx1 = byDist1[0].i;
  let idx2 = byDist2[0].i;
  if (idx1 === idx2 && candidates.length >= 2) idx2 = byDist2[1].i;
  return [{ platformIndex: idx1, offset: 0.5 }, { platformIndex: idx2, offset: 0.5 }];
}

export function generateLavaBounceItem(seed, H) {
  const rng = makeRng(seed);
  const x = LEVEL_LENGTH / 2 + rngRange(rng, -80, 80);
  const y = H - 220 + rngRange(rng, -30, 30);
  return [{ type: "lavaBounce", x, y, w: 28, h: 28 }];
}

export function generateFireTotemItem(seed, H) {
  const rng = makeRng(seed);
  const x = LEVEL_LENGTH / 4 + rngRange(rng, -60, 60);
  const y = H - 200 + rngRange(rng, -40, 20);
  return [{ type: "fireTotem", x, y, w: 24, h: 36 }];
}

export function generateDots(platforms, seed, goal, slimeDefs, crawlerDefs) {
  const dots = [];
  const maxX = goal && typeof goal.x === "number" ? goal.x - DOT_SAFETY_MARGIN : LEVEL_LENGTH - 50;
  const crawlerPlatforms = new Set((crawlerDefs || []).map(c => c.platformIndex));
  const slimeByPlatform = new Map();
  (slimeDefs || []).forEach(s => slimeByPlatform.set(s.platformIndex, s));
  const safePlatforms = (platforms || []).map((p, i) => ({ p, i })).filter(
    ({ p, i }) => p && p.w > 12 && p.x < maxX && !crawlerPlatforms.has(i)
  );
  const segments = [];
  for (const { p, i } of safePlatforms) {
    const left = p.x + 8;
    const right = Math.min(p.x + p.w - 8, maxX - 4);
    const slime = slimeByPlatform.get(i);
    const y = p.y - 6;
    if (slime && right > left) {
      const avoidL = Math.max(left, p.x + p.w * (slime.offset - SLIME_AVOID_BAND));
      const avoidR = Math.min(right, p.x + p.w * (slime.offset + SLIME_AVOID_BAND));
      if (avoidL > left) segments.push({ left, right: avoidL, y });
      if (right > avoidR) segments.push({ left: avoidR, right, y });
    } else if (right > left) {
      segments.push({ left, right, y });
    }
  }
  const totalLen = segments.reduce((s, seg) => s + (seg.right - seg.left), 0);
  if (totalLen <= 0 || segments.length === 0) return dots;
  for (let j = 0; j < NUM_DOTS; j++) {
    const t = (j + 0.5) / NUM_DOTS;
    const targetPos = t * totalLen;
    let acc = 0;
    for (const seg of segments) {
      const len = seg.right - seg.left;
      if (acc + len >= targetPos) {
        dots.push({ x: seg.left + (targetPos - acc), y: seg.y });
        break;
      }
      acc += len;
    }
  }
  return dots;
}

function pickSlimeCountForDifficulty(difficulty) {
  if (difficulty <= 3) return 1;
  if (difficulty <= 6) return 2;
  if (difficulty <= 10) return 3;
  if (difficulty <= 15) return 4;
  if (difficulty <= 20) return 5;
  if (difficulty <= 25) return 6;
  return 7;
}

export function generateSlimesForPlatforms(platforms, difficulty, seed) {
  const rng = makeRng(seed);
  const indices = [];
  for (let i = 1; i < platforms.length; i++) indices.push(i);
  if (!indices.length) return [];
  const maxSlimes = pickSlimeCountForDifficulty(difficulty);
  const count = Math.min(maxSlimes, indices.length);
  const defs = [];
  for (let n = 0; n < count; n++) {
    const pick = Math.floor(rng() * indices.length);
    const platformIndex = indices.splice(pick, 1)[0];
    defs.push({ platformIndex, offset: rngRange(rng, 0.2, 0.8), delay: Math.floor(60 + rng() * 120) });
  }
  return defs;
}

function pickBatCountForDifficulty(difficulty) {
  if (difficulty <= 8) return 1;
  if (difficulty <= 16) return 2;
  if (difficulty <= 24) return 3;
  return 4;
}

export function generateBats(difficulty, seed, H) {
  const rng = makeRng(seed);
  const count = pickBatCountForDifficulty(difficulty);
  const defs = [];
  const marginX = 250;
  const yMin = 100;
  const yMax = H - 150;
  for (let i = 0; i < count; i++) {
    defs.push({
      x: rngRange(rng, marginX, LEVEL_LENGTH - marginX),
      y: rngRange(rng, yMin, yMax),
      rngSeed: seed + 777 + i
    });
  }
  return defs;
}
