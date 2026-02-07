/* ============================================================
   BASIC SETUP
============================================================ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const LEVEL_LENGTH = 4000;
// Reference FPS the game was tuned for; we use delta-time so 1 real second = 1 game second on all devices.
const REFERENCE_FPS = 60;
const gravity = 0.5 * REFERENCE_FPS * REFERENCE_FPS; // px/s² (was 0.5 px/frame² at 60fps)
const moveSpeed = 3.5 * REFERENCE_FPS;     // px per second
const jumpStrength = 10 * REFERENCE_FPS;   // initial upward vy (px/s)

/* ============================================================
   LEVEL STORAGE SYSTEM + DEFAULT PACK
============================================================ */
const LEVELS_STORAGE_KEY = "dragonLevels";

// 30 hand-crafted level metas with IDs and difficulty (1..30).
// Layouts are generated deterministically from these using a seeded RNG,
// then stored like any other level the first time they are needed.
const DEFAULT_LEVELS = [
  { id: "pack-01", name: "1 Lava Warmup", difficulty: 1, seed: 101 },
  { id: "pack-02", name: "2 Baby Dragon Steps", difficulty: 2, seed: 102 },
  { id: "pack-03", name: "3 Hot Coals Hop", difficulty: 3, seed: 103 },
  { id: "pack-04", name: "4 Bridge of Embers", difficulty: 4, seed: 104 },
  { id: "pack-05", name: "5 Molten Alley", difficulty: 5, seed: 105 },
  { id: "pack-06", name: "6 Ember Staircase", difficulty: 6, seed: 106 },
  { id: "pack-07", name: "7 Blistering Boulevard", difficulty: 7, seed: 107 },
  { id: "pack-08", name: "8 Smoldering Switchbacks", difficulty: 8, seed: 108 },
  { id: "pack-09", name: "9 Charred Cliffs", difficulty: 9, seed: 109 },
  { id: "pack-10", name: "10 Ashen Arches", difficulty: 10, seed: 110 },
  { id: "pack-11", name: "11 Scorched Skyline", difficulty: 11, seed: 111 },
  { id: "pack-12", name: "12 Inferno Interval", difficulty: 12, seed: 112 },
  { id: "pack-13", name: "13 Dragon’s Gauntlet", difficulty: 13, seed: 113 },
  { id: "pack-14", name: "14 Volcanic Vertigo", difficulty: 14, seed: 114 },
  { id: "pack-15", name: "15 Lava Lanes", difficulty: 15, seed: 115 },
  { id: "pack-16", name: "16 Pyro Plateau", difficulty: 16, seed: 116 },
  { id: "pack-17", name: "17 Magma Maze", difficulty: 17, seed: 117 },
  { id: "pack-18", name: "18 Searing Spires", difficulty: 18, seed: 118 },
  { id: "pack-19", name: "19 Cinder City", difficulty: 19, seed: 119 },
  { id: "pack-20", name: "20 Firefall Freeway", difficulty: 20, seed: 120 },
  { id: "pack-21", name: "21 Blaze Bridges", difficulty: 21, seed: 121 },
  { id: "pack-22", name: "22 Furnace Free Climb", difficulty: 22, seed: 122 },
  { id: "pack-23", name: "23 Hellmouth Highway", difficulty: 23, seed: 123 },
  { id: "pack-24", name: "24 Overheated Overhangs", difficulty: 24, seed: 124 },
  { id: "pack-25", name: "25 Phoenix Pathway", difficulty: 25, seed: 125 },
  { id: "pack-26", name: "26 Dragonflight Drill", difficulty: 26, seed: 126 },
  { id: "pack-27", name: "27 Lava Labyrinth", difficulty: 27, seed: 127 },
  { id: "pack-28", name: "28 Skyfire Straits", difficulty: 28, seed: 128 },
  { id: "pack-29", name: "29 Meltdown Marathon", difficulty: 29, seed: 129 },
  { id: "pack-30", name: "30 Apocalypse Apex", difficulty: 30, seed: 130 }
];

// Simple deterministic RNG so each default level is reproducible.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Generate cave ceiling polyline and stalactite definitions for a level.
// We take platforms into account so stalactites never hang impossibly close
// to platform tops.
function generateCeilingAndStalactites(difficulty, seed, platforms) {
  const rng = makeRng(seed);
  const pts = [];

  const dClamped = Math.max(1, Math.min(30, difficulty));
  const t = (dClamped - 1) / 29; // 0..1

  const step = 120; // horizontal spacing between ceiling joints
  let x = 0;
  let baseY = 30;           // overall higher ceiling
  const amp = 8 + t * 22;   // moderate jaggedness

  while (x <= LEVEL_LENGTH) {
    let y = baseY + rngRange(rng, -amp, amp);
    // Keep ceiling well above play space
    y = Math.max(10, Math.min(70, y));
    pts.push({ x, y });
    baseY = baseY * 0.7 + y * 0.3;
    x += step;
  }

  // Stalactites: small set of downward spikes along the ceiling.
  const stalDefs = [];
  const maxStals = 3 + Math.floor(dClamped / 4); // 3..10-ish
  const available = pts.slice(1, pts.length - 1); // avoid very edges
  for (let i = 0; i < maxStals && available.length > 0; i++) {
    const idx = Math.floor(rng() * available.length);
    const p = available.splice(idx, 1)[0];
    const w = 18 + rng() * 8;
    const lenMin = 18 + t * 6;
    const lenMax = 34 + t * 10; // globally shorter spikes
    let length = rngRange(rng, lenMin, lenMax);

    // Adjust length so the tip stays safely above the nearest platform below.
    if (Array.isArray(platforms) && platforms.length) {
      let nearestY = Infinity;
      for (const plat of platforms) {
        if (!plat) continue;
        const withinX = p.x >= plat.x && p.x <= plat.x + plat.w;
        if (!withinX) continue;
        if (plat.y > p.y && plat.y < nearestY) {
          nearestY = plat.y;
        }
      }

      if (nearestY < Infinity) {
        const dragonHeight = 26; // matches dragon.h
        // Keep a very generous margin above any platform:
        // - On easy levels: ~3.0x dragon height
        // - On hardest levels: still >= ~2.5x dragon height
        const mult = 3.0 - 0.5 * t; // 3.0 → 2.5
        const extraPadding = 16;
        const clearance = dragonHeight * mult + extraPadding;
        const maxAllowed = nearestY - p.y - clearance;
        if (maxAllowed <= dragonHeight) {
          // Space is too tight; skip this stalactite entirely so it can't
          // make the passage impossible.
          continue;
        }
        length = Math.min(length, maxAllowed);
      }
    }

    stalDefs.push({ x: p.x, y: p.y, length, w });
  }

  return { ceilingPoints: pts, stalactites: stalDefs };
}

// Generate a platform layout whose difficulty scales mainly with:
// - average horizontal gap between platforms
// - platform width (shrinks with difficulty)
// - vertical variance (more up/down for higher difficulty)
function generateDefaultLevelLayout(difficulty, seed) {
  const rng = makeRng(seed);
  const platforms = [];

  const start = {
    x: 40,
    y: H - 140,
    w: 180,
    h: 16
  };
  platforms.push(start);

  const maxPlatforms = 16 + Math.floor(difficulty * 0.7); // more steps on harder levels

  let x = start.x + start.w + 70;
  let baseY = H - 150;

  // Parameters that scale with difficulty 1..30
  const gapMin = 90 + difficulty * 4;   // ~94..210
  const gapMax = 130 + difficulty * 8;  // ~138..370

  // Platform width shrinks with difficulty. At the easiest (difficulty 1)
  // we keep the current wide platforms; by the hardest, widths are at most
  // half of that. We also bias toward more short platforms as difficulty
  // increases, but always allow some longer ones.
  const dClamped = Math.max(1, Math.min(30, difficulty));
  const t = (dClamped - 1) / 29; // 0 at easiest, 1 at hardest
  const easyMin = 140;
  const easyMax = 220;
  const hardMin = easyMin * 0.5;
  const hardMax = easyMax * 0.5;
  const globalMin = easyMin + (hardMin - easyMin) * t;
  const globalMax = easyMax + (hardMax - easyMax) * t;

  // Short vs long mix:
  // - At low difficulty, mostly long platforms with an occasional shorter one.
  // - At high difficulty, mostly short platforms with an occasional longer one.
  const shortProb = 0.2 + 0.6 * t; // 0.2 -> 0.8
  const shortMin = globalMin * 0.6;
  const shortMax = globalMin;
  const longMin  = globalMin;
  const longMax  = globalMax * 1.1; // allow some slightly longer survivors

  const vertAmp = 40 + difficulty * 3; // more vertical chaos as difficulty rises

  for (let i = 0; i < maxPlatforms; i++) {
    const gap = rngRange(rng, gapMin, gapMax);
    x += gap;
    if (x > LEVEL_LENGTH - 260) break;

    // Choose between a short or long platform to keep variety.
    const useShort = rng() < shortProb;
    const w = useShort
      ? rngRange(rng, shortMin, shortMax)
      : rngRange(rng, longMin, longMax);

    // Vertical offset around baseY; clamp to a safe band.
    let y = baseY + rngRange(rng, -vertAmp, vertAmp);
    y = Math.max(80, Math.min(H - 180, y));

    const platform = {
      x,
      y,
      w,
      h: 16
    };

    // Optionally add a gentle bend to the platform shape at higher
    // difficulties. This only affects drawing; collision still uses the
    // bounding box to keep physics simple.
    const bendChance = 0.1 + 0.6 * t; // more bends on harder levels
    if (rng() < bendChance) {
      const joint = rngRange(rng, 0.25, 0.75); // bend point along width
      const sign = rng() < 0.5 ? -1 : 1;       // up or down
      const maxBendPixels = 14;
      const bendHeight = sign * rngRange(rng, 6, maxBendPixels);
      platform.bend = { joint, bendHeight };
    }

    platforms.push(platform);

    // Slightly bias next baseY toward current y, so we get gentle ramps.
    baseY = baseY * 0.6 + y * 0.4;
  }

  // Mark some platforms as drop platforms based on difficulty.
  const dropProbBase = 0.06 + 0.18 * t; // ~6% → ~24%
  const maxDroppers = Math.max(1, Math.floor((platforms.length - 2) * (0.08 + 0.2 * t)));
  let dropCount = 0;
  for (let i = 1; i < platforms.length - 1 && dropCount < maxDroppers; i++) {
    const p = platforms[i];
    if (!p) continue;
    // Avoid extremely low platforms that are almost at lava level.
    if (p.y > H - 120) continue;
    if (rng() > dropProbBase) continue;
    const delay = 30 + rng() * 45; // ~0.5–1.25s of standing time
    const speed = 2.4 + t * 1.6;   // faster drop on harder levels
    p.drop = { delay, speed };
    dropCount++;
  }

  const last = platforms[platforms.length - 1];
  const goalX = Math.min(LEVEL_LENGTH - 120, last.x + last.w + 80);

  const goal = {
    x: goalX,
    y: H - 120,
    w: 50,
    h: 80
  };

  const cave = generateCeilingAndStalactites(difficulty, seed + 321, platforms);
  const bats = generateBats(difficulty, seed + 777);
  const items = generateLavaBounceItem(seed + 888).concat(generateFireTotemItem(seed + 999));
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

// --- Crawler obstacle (patrols platform back and forth; touch = reset) --------
function pickCrawlerCountForDifficulty(difficulty) {
  if (difficulty <= 5) return 1;
  if (difficulty <= 15) return 2;
  return 3;
}

function generateCrawlers(platforms, slimeDefs, difficulty, seed) {
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
    const { i } = candidates[idx];
    const offset = rng();
    defs.push({ platformIndex: i, offset });
  }
  return defs;
}

// --- Checkpoints (two per level at ~1/3 and ~2/3, on platforms without slimes) -
const POLE_W = 12;
const POLE_H = 40;

function generateCheckpoints(platforms, slimeDefs, seed) {
  const slimePlatformIndices = new Set((slimeDefs || []).map(s => s.platformIndex));
  const candidates = platforms
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i > 0 && !slimePlatformIndices.has(i));

  if (candidates.length < 2) return [];

  const target1 = LEVEL_LENGTH / 3;
  const target2 = (LEVEL_LENGTH * 2) / 3;

  const center = ({ p }) => p.x + p.w / 2;
  const byDist1 = [...candidates].sort((a, b) =>
    Math.abs(center(a) - target1) - Math.abs(center(b) - target1));
  const byDist2 = [...candidates].sort((a, b) =>
    Math.abs(center(a) - target2) - Math.abs(center(b) - target2));

  let idx1 = byDist1[0].i;
  let idx2 = byDist2[0].i;
  if (idx1 === idx2 && candidates.length >= 2) {
    idx2 = byDist2[1].i;
  }

  return [
    { platformIndex: idx1, offset: 0.5 },
    { platformIndex: idx2, offset: 0.5 }
  ];
}

// --- Lava bounce pickup (one per level, middle of level) ---------------------
function generateLavaBounceItem(seed) {
  const rng = makeRng(seed);
  const x = LEVEL_LENGTH / 2 + rngRange(rng, -80, 80);
  const y = H - 220 + rngRange(rng, -30, 30);
  return [{ type: "lavaBounce", x, y, w: 28, h: 28 }];
}

// --- Fire totem (one per level, ~1/4 through so you get it early) ------------
function generateFireTotemItem(seed) {
  const rng = makeRng(seed);
  const x = LEVEL_LENGTH / 4 + rngRange(rng, -60, 60);
  const y = H - 200 + rngRange(rng, -40, 20);
  return [{ type: "fireTotem", x, y, w: 24, h: 36 }];
}

// --- Collectible dots (30 per level, on platform tops only, before goal, avoid obstacles) -
const NUM_DOTS = 30;
const DOT_R = 3.5;  // hitbox and diamond size
const DOT_SAFETY_MARGIN = 15;  // no dots this close to goal
const SLIME_AVOID_BAND = 0.28;  // don't place dot within this normalized width of slime

function generateDots(platforms, seed, goal, slimeDefs, crawlerDefs) {
  const dots = [];
  const maxX = goal && typeof goal.x === "number" ? goal.x - DOT_SAFETY_MARGIN : LEVEL_LENGTH - 50;
  const crawlerPlatforms = new Set((crawlerDefs || []).map(c => c.platformIndex));
  const slimeByPlatform = new Map();
  (slimeDefs || []).forEach(s => slimeByPlatform.set(s.platformIndex, s));
  const safePlatforms = (platforms || []).map((p, i) => ({ p, i })).filter(
    ({ p, i }) => p && p.w > 12 && p.x < maxX && !crawlerPlatforms.has(i)
  );
  // Build a flat list of segments { left, right, y } with cumulative length for even distribution
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
  // Place NUM_DOTS at evenly spaced positions along the total span
  for (let j = 0; j < NUM_DOTS; j++) {
    const t = (j + 0.5) / NUM_DOTS;
    const targetPos = t * totalLen;
    let acc = 0;
    for (const seg of segments) {
      const len = seg.right - seg.left;
      if (acc + len >= targetPos) {
        const x = seg.left + (targetPos - acc);
        dots.push({ x, y: seg.y });
        break;
      }
      acc += len;
    }
  }
  return dots;
}

// --- Slime placement helpers ------------------------------------------------

function pickSlimeCountForDifficulty(difficulty) {
  if (difficulty <= 3) return 1;
  if (difficulty <= 6) return 2;
  if (difficulty <= 10) return 3;
  if (difficulty <= 15) return 4;
  if (difficulty <= 20) return 5;
  if (difficulty <= 25) return 6;
  return 7;
}

// Generate static slime definitions for a given platform layout + difficulty.
// At most one slime per platform, never on the starting platform (index 0).
function generateSlimesForPlatforms(platforms, difficulty, seed) {
  const rng = makeRng(seed);
  const indices = [];
  for (let i = 1; i < platforms.length; i++) {
    indices.push(i); // skip start platform at index 0
  }
  if (!indices.length) return [];

  const maxSlimes = pickSlimeCountForDifficulty(difficulty);
  const count = Math.min(maxSlimes, indices.length);
  const defs = [];

  for (let n = 0; n < count; n++) {
    const pick = Math.floor(rng() * indices.length);
    const platformIndex = indices.splice(pick, 1)[0];
    const offset = rngRange(rng, 0.2, 0.8); // somewhere safely on the platform
    const delay = Math.floor(60 + rng() * 120); // 1–3 seconds before first jump
    defs.push({ platformIndex, offset, delay });
  }

  return defs;
}

// --- Bat obstacle (spawn in air, move randomly; touch = reset) --------------
function pickBatCountForDifficulty(difficulty) {
  if (difficulty <= 8) return 1;
  if (difficulty <= 16) return 2;
  if (difficulty <= 24) return 3;
  return 4;
}

function generateBats(difficulty, seed) {
  const rng = makeRng(seed);
  const count = pickBatCountForDifficulty(difficulty);
  const defs = [];
  const marginX = 250;
  const yMin = 100;
  const yMax = H - 150;

  for (let i = 0; i < count; i++) {
    const x = rngRange(rng, marginX, LEVEL_LENGTH - marginX);
    const y = rngRange(rng, yMin, yMax);
    defs.push({ x, y, rngSeed: seed + 777 + i });
  }
  return defs;
}

function ensureDefaultLevelsSeeded(data) {
  if (!data || !Array.isArray(data.levels)) {
    data = { levels: [] };
  }
  let changed = false;

  DEFAULT_LEVELS.forEach(meta => {
    let lvl = data.levels.find(l => l.id === meta.id);
    if (!lvl) {
      const layout = generateDefaultLevelLayout(meta.difficulty, meta.seed);
      data.levels.push({
        id: meta.id,
        name: meta.name,
        platforms: layout.platforms,
        goal: layout.goal,
        bestScore: Infinity,
        bestDots: 0,
        difficulty: meta.difficulty,
        slimes: layout.slimes,
        ceiling: layout.ceilingPoints,
        stalactites: layout.stalactites,
        bats: layout.bats,
        items: layout.items,
        dots: layout.dots,
        checkpoints: layout.checkpoints,
        crawlers: layout.crawlers
      });
      changed = true;
    } else {
      // Normalize any existing bestScore values that may be null/undefined.
      if (typeof lvl.bestScore !== "number" || !isFinite(lvl.bestScore)) {
        lvl.bestScore = Infinity;
        changed = true;
      }
      if (typeof lvl.bestDots !== "number" || lvl.bestDots < 0) {
        lvl.bestDots = 0;
        changed = true;
      }
      // Backfill difficulty & slime definitions for older stored data.
      if (lvl.difficulty == null) {
        lvl.difficulty = meta.difficulty;
        changed = true;
      }
      if (!Array.isArray(lvl.slimes)) {
        lvl.slimes = generateSlimesForPlatforms(
          lvl.platforms,
          lvl.difficulty || meta.difficulty,
          meta.seed + 999
        );
        changed = true;
      }

      // Ensure default levels also have a cave ceiling and stalactites.
      if (!Array.isArray(lvl.ceiling) || !Array.isArray(lvl.stalactites)) {
        const cave = generateCeilingAndStalactites(
          lvl.difficulty || meta.difficulty,
          meta.seed + 321,
          lvl.platforms
        );
        lvl.ceiling = cave.ceilingPoints;
        lvl.stalactites = cave.stalactites;
        changed = true;
      }

      // Backfill bats for older stored levels.
      if (!Array.isArray(lvl.bats)) {
        lvl.bats = generateBats(lvl.difficulty || meta.difficulty, meta.seed + 777);
        changed = true;
      }

      if (!Array.isArray(lvl.items)) lvl.items = [];
      if (!lvl.items.some(i => i && i.type === "lavaBounce")) {
        lvl.items = lvl.items.concat(generateLavaBounceItem(meta.seed + 888));
        changed = true;
      }
      if (!lvl.items.some(i => i && i.type === "fireTotem")) {
        lvl.items = lvl.items.concat(generateFireTotemItem(meta.seed + 999));
        changed = true;
      }

      if (!Array.isArray(lvl.dots) || lvl.dots.length !== NUM_DOTS) {
        lvl.dots = generateDots(lvl.platforms || [], meta.seed + 444, lvl.goal, lvl.slimes, lvl.crawlers);
        changed = true;
      }

      if (!Array.isArray(lvl.checkpoints)) {
        lvl.checkpoints = generateCheckpoints(
          lvl.platforms,
          lvl.slimes || [],
          meta.seed + 111
        );
        changed = true;
      }

      if (!Array.isArray(lvl.crawlers) || lvl.crawlers.length === 0) {
        lvl.crawlers = generateCrawlers(
          lvl.platforms,
          lvl.slimes || [],
          lvl.difficulty || meta.difficulty,
          meta.seed + 555
        );
        changed = true;
      }

      // If this default level was created before bends existed, retrofit bends
      // onto some of its platforms without moving them.
      const anyBent = Array.isArray(lvl.platforms) &&
        lvl.platforms.some(p => p && p.bend);
      if (Array.isArray(lvl.platforms) && !anyBent) {
        const d = lvl.difficulty || meta.difficulty;
        const dClamped = Math.max(1, Math.min(30, d));
        const t = (dClamped - 1) / 29; // 0 at easiest, 1 at hardest
        const bendChance = 0.1 + 0.6 * t;
        const rng = makeRng(meta.seed + 555);

        lvl.platforms.forEach((p, index) => {
          // Skip start platform, and only add bends to "normal" platforms.
          if (!p || index === 0 || p.bend) return;
          if (rng() >= bendChance) return;
          const joint = 0.25 + rng() * 0.5; // 0.25–0.75
          const sign = rng() < 0.5 ? -1 : 1;
          const maxBendPixels = 14;
          const bendHeight = sign * (6 + rng() * (maxBendPixels - 6));
          p.bend = { joint, bendHeight };
        });

        changed = true;
      }
    }
  });

  if (changed) {
    saveAllLevels(data);
  }
  return data;
}

function loadAllLevels() {
  let data;
  try {
    const raw = localStorage.getItem(LEVELS_STORAGE_KEY);
    if (!raw) {
      data = { levels: [] };
    } else {
      data = JSON.parse(raw);
      if (!data || !Array.isArray(data.levels)) {
        data = { levels: [] };
      }
    }
  } catch {
    data = { levels: [] };
  }
  return ensureDefaultLevelsSeeded(data);
}

function saveAllLevels(data) {
  localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(data));
}

function saveCompletedLevel(levelID, name, platforms, goal, bestScore, dotsCollected) {
  const data = loadAllLevels();

  const existing = data.levels.find(l => l.id === levelID);
  const dots = typeof dotsCollected === "number" ? dotsCollected : 0;

  if (existing) {
    if (typeof existing.bestScore !== "number" || !isFinite(existing.bestScore)) {
      existing.bestScore = Infinity;
    }
    if (bestScore < existing.bestScore) {
      existing.bestScore = bestScore;
      saveAllLevels(data);
    }
    if (dots > (existing.bestDots ?? 0)) {
      existing.bestDots = dots;
      saveAllLevels(data);
    }
    return; // DO NOT ask for name again
  }

  // New user-created level
  data.levels.push({
    id: levelID,
    name,
    platforms,
    goal,
    bestScore,
    bestDots: dots,
    difficulty: currentDifficulty,
    slimes: slimeDefs,
    ceiling: ceilingPoints,
    stalactites: stalactiteDefs,
    bats: batDefs,
    items: itemDefs,
    dots: dotDefs.length === NUM_DOTS ? dotDefs : generateDots(platforms, (currentLevelSeed || 0) + 444, goal, slimeDefs, crawlerDefs),
    checkpoints: checkpointDefs,
    crawlers: crawlerDefs
  });

  saveAllLevels(data);
  populateLevelDropdown();
}

/* ============================================================
   PLAYER
============================================================ */
const dragon = {
  x: 0,
  y: 0,
  w: 30,
  h: 26,
  vx: 0,
  vy: 0,
  onGround: false,
  facing: 1,
  boostCooldown: 0,
  jumpsLeft: 2,
  boostAvailable: true,
  boostFramesLeft: 0        // seconds left of boost (time-based)
};

let cameraX = 0;
let dragonTrail = []; // { x, y, facing } for motion trail (oldest first)
const TRAIL_LENGTH = 14;
let jumpKeyReleased = true; // so air jump only triggers once per key press
let timeInAir = 0;          // seconds since left ground; boost only starts after a short delay
let currentDifficulty = null; // difficulty of the currently loaded level (if any)

// Slime obstacles (runtime instances) are built from per-level slimeDefs.
let slimeDefs = []; // [{ platformIndex, offset, delay }]
let slimes = [];    // runtime objects with positions/velocities

// Cave ceiling + stalactites
let ceilingPoints = [];      // [{ x, y }]
let stalactiteDefs = [];     // [{ x, y, length, w }]
let stalactites = [];        // runtime stalactite objects (copied from defs)

// Bats: spawn in air, move randomly; touch = reset
let batDefs = [];            // [{ x, y, rngSeed }]
let bats = [];               // runtime: { x, y, vx, vy, w, h, rng }

// Crawlers: patrol platforms back and forth; touch = reset
let crawlerDefs = [];        // [{ platformIndex, offset, dir }]
let crawlers = [];           // runtime: { x, y, w, h, platformIndex, offset, dir }

// Pickups (e.g. lava bounce) – defs from level, collected state per run
let itemDefs = [];           // [{ type, x, y, w, h }]
let lavaBounceItemCollected = false;
let lavaBounceTimer = 0;     // seconds left of lava-bounce effect (0 = inactive)
let fireBreathsLeft = 0;     // 0 = none, 1 = has flame (unlimited breath until hit by monster)
let fireTotemCollected = false;
let breathActiveTime = 0;   // seconds left while breath hitbox is active
let breathKeyConsumed = false; // so one key press = one breath

// Dots: 100 per level, collected state resets each run
let dotDefs = [];           // [{ x, y }]
let dotsCollected = [];     // boolean per dot
let dotsCollectedCount = 0;

// Checkpoints: two per level at ~1/3 and ~2/3; respawn at last touched on death
let checkpointDefs = [];     // [{ platformIndex, offset }]
let lastCheckpointIndex = -1; // -1 = start, 0 or 1 = respawn at that checkpoint

// Snapshot of the original platform layout for the current level so we can
// fully reset drop-platform state (positions/timers) on every death.
let basePlatforms = [];

function buildSlimesFromDefs() {
  slimes = [];
  const slimeW = 22;
  const slimeH = 18;

  slimeDefs.forEach(def => {
    const p = platforms[def.platformIndex];
    if (!p) return;
    const offset = typeof def.offset === "number" ? def.offset : 0.5;
    const baseX = p.x + offset * p.w - slimeW / 2;
    const baseY = p.y - slimeH;
    const initialDelay =
      typeof def.delay === "number" && def.delay > 0 ? def.delay : 60 + Math.random() * 120;
    slimes.push({
      platformIndex: def.platformIndex,
      offset,
      x: baseX,
      y: baseY,
      baseX,
      baseY,
      w: slimeW,
      h: slimeH,
      vy: 0,
      state: "waiting",
      timer: initialDelay
    });
  });
}

const SLIME_JUMP_STRENGTH = 7 * REFERENCE_FPS; // px/s, slightly less than dragon so you can clear them

function updateSlimes(dt) {
  slimes.forEach(s => {
    if (s.dead) return;
    const p = platforms[s.platformIndex];
    if (!p) return;
    const baseX = p.x + s.offset * p.w - s.w / 2;
    const baseY = p.y - s.h;

    if (s.state === "waiting") {
      s.x = baseX;
      s.y = baseY;
      s.timer -= dt * REFERENCE_FPS; // timer stored in "frames" for compatibility with level defs
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

function buildStalactitesFromDefs() {
  stalactites = [];
  stalactiteDefs.forEach(def => {
    if (typeof def.x !== "number" || typeof def.y !== "number") return;
    const w = def.w || 24;
    const length = def.length || 40;
    stalactites.push({
      x: def.x,
      y: def.y,
      length,
      w
    });
  });
}

const BAT_W = 24;
const BAT_H = 16;
const BAT_MAX_SPEED = 2.2 * REFERENCE_FPS;       // px/s
const BAT_WANDER_STRENGTH = 0.5 * REFERENCE_FPS; // acceleration scale per second

function buildBatsFromDefs() {
  bats = [];
  batDefs.forEach(def => {
    if (typeof def.x !== "number" || typeof def.y !== "number") return;
    const rngSeed = typeof def.rngSeed === "number" ? def.rngSeed : 0;
    bats.push({
      x: def.x,
      y: def.y,
      vx: 0,
      vy: 0,
      w: BAT_W,
      h: BAT_H,
      rng: makeRng(rngSeed)
    });
  });
}

const CRAWLER_W = 20;
const CRAWLER_H = 14;
const CRAWLER_PERIMETER_SPEED = 0.004 * REFERENCE_FPS; // fraction of perimeter per second (0–1 loop)

// Get position on platform perimeter: t in [0, 1] goes once around (top → right → bottom → left).
function crawlerPerimeterPosition(p, t) {
  const tw = p.w;
  const th = p.h;
  if (t < 0.25) {
    const f = t / 0.25;
    return { cx: p.x + f * tw, cy: p.y };
  }
  if (t < 0.5) {
    const f = (t - 0.25) / 0.25;
    return { cx: p.x + tw, cy: p.y + f * th };
  }
  if (t < 0.75) {
    const f = (t - 0.5) / 0.25;
    return { cx: p.x + tw - f * tw, cy: p.y + th };
  }
  const f = (t - 0.75) / 0.25;
  return { cx: p.x, cy: p.y + th - f * th };
}

function buildCrawlersFromDefs() {
  crawlers = [];
  crawlerDefs.forEach(def => {
    const p = platforms[def.platformIndex];
    if (!p) return;
    const offset = Math.max(0, Math.min(1, def.offset));
    const { cx, cy } = crawlerPerimeterPosition(p, offset);
    crawlers.push({
      x: cx - CRAWLER_W / 2,
      y: cy - CRAWLER_H / 2,
      w: CRAWLER_W,
      h: CRAWLER_H,
      platformIndex: def.platformIndex,
      offset
    });
  });
}

function updateCrawlers(dt) {
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
  if (!Array.isArray(platforms) || !platforms.length) return;

  const dClamped = currentDifficulty == null
    ? 1
    : Math.max(1, Math.min(30, currentDifficulty));
  const t = (dClamped - 1) / 29;

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (!p || !p.drop) continue;

    // Initialise runtime state the first time we see this platform.
    // delay is in frames (from level gen), convert to seconds for countdown.
    if (p.dropTimer == null) {
      p.dropTimer = p.drop.delay / REFERENCE_FPS;
      p.dropping = false;
      p.dropActive = false;
    }

    // If the dragon is currently standing on this platform and it hasn't
    // started falling yet, count down its timer and mark it as active.
    if (standingPlatformIndex === i && !p.dropping) {
      p.dropActive = true;
      if (p.dropTimer > 0) {
        p.dropTimer -= dt;
      }
      if (p.dropTimer <= 0) {
        p.dropping = true;
      }
    }

    // Once dropping, move the platform down (speed is per-frame from level gen → px/s = speed * REFERENCE_FPS).
    if (p.dropping) {
      p.y += p.drop.speed * REFERENCE_FPS * dt;
    }
  }
}

/* ============================================================
   INPUT
============================================================ */
const keys = { left: false, right: false, jump: false, boost: false, breath: false };

window.addEventListener("keydown", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") keys.jump = true;
  if (e.code === "KeyF") keys.boost = true;
  if (e.code === "KeyG") keys.breath = true;
});

window.addEventListener("keyup", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    keys.jump = false;
    jumpKeyReleased = true;
  }
  if (e.code === "KeyF") keys.boost = false;
  if (e.code === "KeyG") { keys.breath = false; breathKeyConsumed = false; }
});

/* On-screen controls: set keys on pointer down/up so touch and mouse both work */
function bindButton(id, keyName) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const setKey = (v) => { keys[keyName] = v; };

  btn.addEventListener("pointerdown", e => { e.preventDefault(); setKey(true); });
  btn.addEventListener("pointerup", e => { e.preventDefault(); setKey(false); });
  btn.addEventListener("pointerleave", e => { setKey(false); });
  btn.addEventListener("pointercancel", e => { setKey(false); });
}
bindButton("btnLeft", "left");
bindButton("btnRight", "right");
bindButton("btnJump", "jump");
bindButton("btnBoost", "boost");
bindButton("btnBreath", "breath");
// On-screen jump button releases the key on pointer up, so jumpKeyReleased is set by the same keyup flow when they lift finger
document.getElementById("btnJump")?.addEventListener("pointerup", () => { jumpKeyReleased = true; });
document.getElementById("btnJump")?.addEventListener("pointerleave", () => { jumpKeyReleased = true; });
document.getElementById("btnBreath")?.addEventListener("pointerup", () => { breathKeyConsumed = false; });
document.getElementById("btnBreath")?.addEventListener("pointerleave", () => { breathKeyConsumed = false; });

/* ============================================================
   LEVEL GENERATION
============================================================ */
let platforms = [];
let startPlatform = null;
let goal = null;
let bestScore = Infinity;
let currentLevelID = null; // track which level is loaded
let currentLevelSeed = null; // seed for share URL (#42)
let skipNextHashChange = false; // true when we set hash ourselves, so hashchange doesn't reload

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Generate a level from a specific seed (and optional difficulty). Used for
// loading from URL hash (#42) and for sharing.
function generateLevelFromSeed(seed, difficulty) {
  difficulty = difficulty != null ? Math.max(1, Math.min(30, difficulty)) : 15;
  seed = Math.floor(Number(seed)) || 0;
  if (seed <= 0) return;

  currentLevelID = "seed-" + seed;
  currentLevelSeed = seed;

  const layout = generateDefaultLevelLayout(difficulty, seed);
  platforms = layout.platforms;
  basePlatforms = JSON.parse(JSON.stringify(layout.platforms));
  startPlatform = platforms[0];
  goal = layout.goal;
  bestScore = Infinity;
  currentDifficulty = difficulty;
  slimeDefs = Array.isArray(layout.slimes) ? layout.slimes : generateSlimesForPlatforms(platforms, difficulty, seed + 999);
  ceilingPoints = layout.ceilingPoints;
  stalactiteDefs = layout.stalactites;
  batDefs = Array.isArray(layout.bats) ? layout.bats : [];
  itemDefs = Array.isArray(layout.items) ? layout.items : [];
  dotDefs = Array.isArray(layout.dots) ? layout.dots : generateDots(platforms, seed + 444, layout.goal, layout.slimes, layout.crawlers);
  dotsCollected = dotDefs.map(() => false);
  dotsCollectedCount = 0;
  checkpointDefs = Array.isArray(layout.checkpoints) ? layout.checkpoints : [];
  crawlerDefs = Array.isArray(layout.crawlers) ? layout.crawlers : [];
  lastCheckpointIndex = -1;
  lives = LIVES_START;
  syncUrlToSeed();
}

function generateRandomLevel() {
  // New random levels are mid-pack difficulty by default.
  const difficulty = Math.floor(randomRange(8, 23)); // 8–22
  const seed = Math.floor(Math.random() * 1_000_000_000);

  currentLevelID = crypto.randomUUID(); // unique ID for this random level
  currentLevelSeed = seed;

  const layout = generateDefaultLevelLayout(difficulty, seed);
  platforms = layout.platforms;
  basePlatforms = JSON.parse(JSON.stringify(layout.platforms));
  startPlatform = platforms[0];
  goal = layout.goal;
  bestScore = Infinity;
  currentDifficulty = difficulty;
  slimeDefs = Array.isArray(layout.slimes) ? layout.slimes : generateSlimesForPlatforms(platforms, difficulty, seed + 999);
  ceilingPoints = layout.ceilingPoints;
  stalactiteDefs = layout.stalactites;
  batDefs = Array.isArray(layout.bats) ? layout.bats : [];
  itemDefs = Array.isArray(layout.items) ? layout.items : [];
  dotDefs = Array.isArray(layout.dots) ? layout.dots : generateDots(platforms, seed + 444, layout.goal, layout.slimes, layout.crawlers);
  dotsCollected = dotDefs.map(() => false);
  dotsCollectedCount = 0;
  checkpointDefs = Array.isArray(layout.checkpoints) ? layout.checkpoints : [];
  crawlerDefs = Array.isArray(layout.crawlers) ? layout.crawlers : [];
  lastCheckpointIndex = -1;
  lives = LIVES_START;
  syncUrlToSeed();
}

/* ============================================================
   LOAD SAVED LEVEL
============================================================ */
function loadLevel(level) {
  currentLevelID = level.id;
  // Seed for share link: from level object or default-pack meta.
  currentLevelSeed = level.seed ?? DEFAULT_LEVELS.find(m => m.id === level.id)?.seed ?? null;

  platforms = JSON.parse(JSON.stringify(level.platforms));
  basePlatforms = JSON.parse(JSON.stringify(level.platforms));
  goal = JSON.parse(JSON.stringify(level.goal));
  bestScore = level.bestScore;
  currentDifficulty = level.difficulty || null;
  slimeDefs = Array.isArray(level.slimes) ? level.slimes : [];
  ceilingPoints = Array.isArray(level.ceiling) ? level.ceiling : [];
  stalactiteDefs = Array.isArray(level.stalactites) ? level.stalactites : [];
  batDefs = Array.isArray(level.bats) ? level.bats : [];
  itemDefs = Array.isArray(level.items) ? level.items : [];
  checkpointDefs = Array.isArray(level.checkpoints) ? level.checkpoints : [];
  crawlerDefs = Array.isArray(level.crawlers) && level.crawlers.length > 0
    ? level.crawlers
    : generateCrawlers(
        level.platforms || platforms,
        level.slimes || slimeDefs,
        level.difficulty != null ? level.difficulty : 15,
        (level.seed != null ? level.seed : 0) + 555
      );
  dotDefs = Array.isArray(level.dots) && level.dots.length === NUM_DOTS
    ? level.dots
    : generateDots(platforms, (level.seed != null ? level.seed : 0) + 444, goal, slimeDefs, crawlerDefs);
  dotsCollected = dotDefs.map(() => false);
  dotsCollectedCount = 0;
  lastCheckpointIndex = -1;
  lives = LIVES_START;

  resetPlayerToStart();
  syncUrlToSeed();
}

/* ============================================================
   LAVA
============================================================ */
const lava = {
  x: 0,
  y: H - 20,
  w: LEVEL_LENGTH,
  h: 40
};

/* ============================================================
   TIMER + WIN STATE
============================================================ */
let timerStarted = false;
let startTime = 0;
let currentTime = 0;
let gameWon = false;
let lavaDeathTimer = 0;
let isDyingInLava = false;
let standingPlatformIndex = -1;

const LIVES_START = 3;
let lives = LIVES_START;

/* ============================================================
   RESET PLAYER
============================================================ */
function applyDeath() {
  lives--;
  if (lives <= 0) {
    lastCheckpointIndex = -1;
    lives = LIVES_START;
  }
  resetPlayerToStart();
}
function resetPlayerToStart() {
  // Fully reset the platform layout (including any drop-platform state)
  // back to the original snapshot for this level.
  if (Array.isArray(basePlatforms) && basePlatforms.length) {
    platforms = JSON.parse(JSON.stringify(basePlatforms));
  }

  let p;
  if (lastCheckpointIndex >= 0 && checkpointDefs[lastCheckpointIndex] && Array.isArray(platforms)) {
    const cp = checkpointDefs[lastCheckpointIndex];
    p = platforms[cp.platformIndex];
    if (p) {
      dragon.x = p.x + p.w * cp.offset - dragon.w / 2;
      dragon.y = p.y - dragon.h;
    } else {
      p = platforms[0];
      dragon.x = p.x + p.w / 2 - dragon.w / 2;
      dragon.y = p.y - dragon.h;
    }
  } else {
    p = platforms[0];
    dragon.x = p.x + p.w / 2 - dragon.w / 2;
    dragon.y = p.y - dragon.h;
  }

  dragon.vx = 0;
  dragon.vy = 0;
  dragon.onGround = true;
  dragon.facing = 1;
  dragon.boostCooldown = 0;
  dragon.jumpsLeft = 2;
  dragon.boostAvailable = true;

  // Rebuild slimes for this level so they start in their idle positions.
  buildSlimesFromDefs();

  // Rebuild stalactites for this level (they are static, but we copy from defs
  // so any future per-run behavior could be added).
  buildStalactitesFromDefs();

  // Rebuild bats so they start at their spawn positions with fresh RNG state.
  buildBatsFromDefs();

  buildCrawlersFromDefs();

  lavaBounceItemCollected = false;
  lavaBounceTimer = 0;
  fireBreathsLeft = 0;
  fireTotemCollected = false;
  breathActiveTime = 0;
  breathKeyConsumed = false;
  // Only reset dots when respawning at the start; keep them when respawning at a checkpoint
  if (lastCheckpointIndex < 0) {
    dotsCollected = dotDefs.map(() => false);
    dotsCollectedCount = 0;
  }

  dragonTrail = [];
  dragon.boostFramesLeft = 0;
  timeInAir = 0;

  timerStarted = false;
  startTime = 0;
  currentTime = 0;
  gameWon = false;
  isDyingInLava = false;
  lavaDeathTimer = 0;
  cameraX = 0;
}

/* ============================================================
   UPDATE LOOP
============================================================ */
function update(dt) {
  if (gameWon) return;

  if (lavaBounceTimer > 0) {
    lavaBounceTimer -= dt;
    if (lavaBounceTimer < 0) lavaBounceTimer = 0;
  }

  // During a lava death animation, we freeze input and just advance the
  // animation timer, then reset once it finishes.
  if (isDyingInLava) {
    lavaDeathTimer -= dt;
    // Sink the dragon slightly into the lava (0.6 px/frame at 60fps = 36 px/s).
    dragon.y += 36 * dt;
    dragon.vx *= Math.pow(0.9, dt * REFERENCE_FPS);
    dragon.vy = 0;
    if (lavaDeathTimer <= 0) {
      applyDeath();
    }
    return;
  }

  if (!timerStarted && (keys.left || keys.right || keys.jump || keys.boost || keys.breath)) {
    timerStarted = true;
    startTime = performance.now();
  }

  if (timerStarted) {
    currentTime = (performance.now() - startTime) / 1000;
  }

  dragon.vx = 0;
  if (keys.left) {
    dragon.vx = -moveSpeed;
    dragon.facing = -1;
  }
  if (keys.right) {
    dragon.vx = moveSpeed;
    dragon.facing = 1;
  }

  // Track how long we've been in the air (reset when we land)
  if (dragon.onGround) {
    timeInAir = 0;
  } else {
    timeInAir += dt;
  }

  if (keys.jump && dragon.onGround) {
    dragon.vy = -jumpStrength;
    dragon.onGround = false;
    dragon.jumpsLeft = 1;
    jumpKeyReleased = false;
  } else if (keys.jump && !dragon.onGround && dragon.jumpsLeft > 0 && jumpKeyReleased) {
    dragon.vy = -jumpStrength;
    dragon.jumpsLeft--;
    jumpKeyReleased = false;
  }

  // Boost: once per jump, only after we've been airborne briefly (time-based).
  const BOOST_AIR_DELAY_SEC = 6 / REFERENCE_FPS;
  const BOOST_DURATION_SEC = 12 / REFERENCE_FPS;
  // Original added (64/12) and (6/12) per frame to vx/vy (px/frame) → need px/s² so scale by REFERENCE_FPS²
  const BOOST_POWER_H = (64 / 12) * REFERENCE_FPS * REFERENCE_FPS;  // px/s² horizontal
  const BOOST_POWER_V = (6 / 12) * REFERENCE_FPS * REFERENCE_FPS;   // px/s² upward
  const maxUpwardVy = -jumpStrength - 0.5 * REFERENCE_FPS;
  if (
    keys.boost &&
    !dragon.onGround &&
    dragon.boostAvailable &&
    timeInAir >= BOOST_AIR_DELAY_SEC
  ) {
    dragon.boostAvailable = false;
    dragon.boostFramesLeft = BOOST_DURATION_SEC;
  }
  if (dragon.boostFramesLeft > 0) {
    dragon.vx += dragon.facing * BOOST_POWER_H * dt;
    dragon.vy = Math.max(dragon.vy - BOOST_POWER_V * dt, maxUpwardVy);
    dragon.boostFramesLeft -= dt;
  }

  // Fire breath: unlimited while you have the flame (consumed only when hit by a monster)
  if (keys.breath && !breathKeyConsumed && fireBreathsLeft > 0 && breathActiveTime <= 0) {
    breathKeyConsumed = true;
    breathActiveTime = 10 / REFERENCE_FPS;
  }

  dragon.vy += gravity * dt;

  updateSlimes(dt);

  dragon.x += dragon.vx * dt;
  dragon.y += dragon.vy * dt;

  // Motion trail: record position when moving or boosting (velocities are in px/s)
  const isMoving = Math.abs(dragon.vx) > 30 || Math.abs(dragon.vy) > 30 || dragon.boostFramesLeft > 0;
  if (isMoving) {
    dragonTrail.push({ x: dragon.x, y: dragon.y, facing: dragon.facing });
    if (dragonTrail.length > TRAIL_LENGTH) dragonTrail.shift();
  } else {
    dragonTrail = []; // clear when stopped so we don't get a static blob
  }

  // Hitbox follows facing: when left, mouth is at dragon.x - dragon.w; when right, mouth at dragon.x + dragon.w
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
  standingPlatformIndex = -1;
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (
      dragonLeft < p.x + p.w &&
      dragonRight > p.x &&
      dragon.y < p.y + p.h &&
      dragon.y + dragon.h > p.y
    ) {
      if (dragon.vy > 0 && dragon.y + dragon.h - dragon.vy * dt <= p.y) {
        dragon.y = p.y - dragon.h;
        dragon.vy = 0;
        dragon.onGround = true;
        dragon.jumpsLeft = 2;
        dragon.boostAvailable = true;
        standingPlatformIndex = i;
      }
    }
  }

  // Slime collision: with flame shield, slime dies and you lose the flame; otherwise death.
  for (const s of slimes) {
    if (s.dead) continue;
    if (
      dragonLeft < s.x + s.w &&
      dragonRight > s.x &&
      dragon.y < s.y + s.h &&
      dragon.y + dragon.h > s.y
    ) {
      if (fireBreathsLeft > 0) {
        s.dead = true;
        fireBreathsLeft = 0;
        fireTotemCollected = false;
      } else {
        applyDeath();
      }
      return;
    }
  }

  // Crawler collision: with flame shield, crawler dies and you lose the flame; otherwise death.
  updateCrawlers(dt);
  for (const c of crawlers) {
    if (c.dead) continue;
    if (
      dragonLeft < c.x + c.w &&
      dragonRight > c.x &&
      dragon.y < c.y + c.h &&
      dragon.y + dragon.h > c.y
    ) {
      if (fireBreathsLeft > 0) {
        c.dead = true;
        fireBreathsLeft = 0;
        fireTotemCollected = false;
      } else {
        applyDeath();
      }
      return;
    }
  }

  // Update drop / falling platforms AFTER we've figured out which one
  // the dragon is standing on this frame.
  updateDropPlatforms(dt);

  // Stalactite collision: cannot be touched.
  for (const st of stalactites) {
    const sx = st.x - st.w / 2;
    const sy = st.y;
    const sw = st.w;
    const sh = st.length;
    if (
      dragonLeft < sx + sw &&
      dragonRight > sx &&
      dragon.y < sy + sh &&
      dragon.y + dragon.h > sy
    ) {
      applyDeath();
      return;
    }
  }

  // Bat collision: cannot touch the bat.
  updateBats(dt);
  for (const b of bats) {
    if (
      dragonLeft < b.x + b.w &&
      dragonRight > b.x &&
      dragon.y < b.y + b.h &&
      dragon.y + dragon.h > b.y
    ) {
      applyDeath();
      return;
    }
  }

  // Checkpoints: touching a pole sets respawn to that checkpoint
  for (let i = 0; i < checkpointDefs.length; i++) {
    if (i <= lastCheckpointIndex) continue;
    const cp = checkpointDefs[i];
    const p = platforms[cp.platformIndex];
    if (!p) continue;
    const poleCenterX = p.x + p.w * cp.offset;
    const poleLeft = poleCenterX - POLE_W / 2;
    const poleTop = p.y - POLE_H;
    if (
      dragonLeft < poleLeft + POLE_W &&
      dragonRight > poleLeft &&
      dragon.y < p.y &&
      dragon.y + dragon.h > poleTop
    ) {
      lastCheckpointIndex = i;
      break;
    }
  }

  // Pickup: lava bounce item (collect before lava check)
  if (!lavaBounceItemCollected) {
    for (const item of itemDefs) {
      if (item.type !== "lavaBounce") continue;
      if (
        dragonLeft < item.x + item.w &&
        dragonRight > item.x &&
        dragon.y < item.y + item.h &&
        dragon.y + dragon.h > item.y
      ) {
        lavaBounceItemCollected = true;
        lavaBounceTimer = 5;
        break;
      }
    }
  }

  // Pickup: fire totem gives flame until you're hit by a monster (unlimited breath + one-hit shield)
  if (!fireTotemCollected) {
    for (const item of itemDefs) {
      if (item.type !== "fireTotem") continue;
      if (
        dragonLeft < item.x + item.w &&
        dragonRight > item.x &&
        dragon.y < item.y + item.h &&
        dragon.y + dragon.h > item.y
      ) {
        fireTotemCollected = true;
        fireBreathsLeft = 1; // 1 = has flame (unlimited breath until hit)
        break;
      }
    }
  }

  // Fire breath hitbox: use visual mouth position (not shifted hitbox) so flame shoots from mouth
  if (breathActiveTime > 0) {
    const breathLen = 50;
    const visualMouthX = dragon.facing > 0
      ? dragonRight + DRAGON_MOUTH_OVERHANG
      : (dragon.x - dragon.w) - DRAGON_MOUTH_OVERHANG;
    const breathEnd = visualMouthX;
    const bx = dragon.facing > 0 ? breathEnd : breathEnd - breathLen;
    const by = dragon.y + 4;
    const bw = breathLen;
    const bh = dragon.h - 8;
    for (const s of slimes) {
      if (s.dead) continue;
      if (bx < s.x + s.w && bx + bw > s.x && by < s.y + s.h && by + bh > s.y) s.dead = true;
    }
    for (const c of crawlers) {
      if (c.dead) continue;
      if (bx < c.x + c.w && bx + bw > c.x && by < c.y + c.h && by + bh > c.y) c.dead = true;
    }
    breathActiveTime -= dt;
  }

  // Collect dots (Pac-Man style). Use a small box centered on the mouth.
  const mouthX = dragon.facing > 0
    ? dragonRight + DRAGON_MOUTH_OVERHANG
    : dragonLeft - DRAGON_MOUTH_OVERHANG;
  const dotBoxLeft = mouthX - DOT_MOUTH_HALF_W;
  const dotBoxRight = mouthX + DOT_MOUTH_HALF_W;
  for (let i = 0; i < dotDefs.length; i++) {
    if (dotsCollected[i]) continue;
    const d = dotDefs[i];
    if (
      dotBoxLeft < d.x + DOT_R &&
      dotBoxRight > d.x - DOT_R &&
      dragon.y < d.y + DOT_R &&
      dragon.y + dragon.h > d.y - DOT_R
    ) {
      dotsCollected[i] = true;
      dotsCollectedCount++;
    }
  }

  if (dragon.y + dragon.h > lava.y) {
    if (lavaBounceTimer > 0) {
      // Bounce out of lava: big upward impulse and place just above lava
      dragon.vy = -18;
      dragon.y = lava.y - dragon.h - 2;
      dragon.onGround = false;
      dragon.jumpsLeft = 1;
      dragon.boostAvailable = false;
      // (timer keeps counting down; multiple bounces allowed until it expires)
    } else {
      isDyingInLava = true;
      lavaDeathTimer = 35 / REFERENCE_FPS; // seconds (was 35 frames)
      return;
    }
  }

  if (
    dragonLeft < goal.x + goal.w &&
    dragonRight > goal.x &&
    dragon.y < goal.y + goal.h &&
    dragon.y + dragon.h > goal.y
  ) {
    gameWon = true;

    const data = loadAllLevels();
    const existing = data.levels.find(l => l.id === currentLevelID);

    if (!existing) {
      const name = prompt("Name this level:");
      if (name) {
        saveCompletedLevel(currentLevelID, name, platforms, goal, currentTime, dotsCollectedCount);
        alert("Level saved!");
      }
    } else {
      saveCompletedLevel(existing.id, existing.name, platforms, goal, currentTime, dotsCollectedCount);
    }

    // Update in-memory bestScore immediately so HUD and dropdown reflect the PB.
    if (typeof bestScore !== "number" || !isFinite(bestScore) || currentTime < bestScore) {
      bestScore = currentTime;
    }
    // Refresh dropdown labels so Best time text updates right away.
    populateLevelDropdown();
  }

  cameraX = dragon.x - W / 2;
  if (cameraX < 0) cameraX = 0;
  if (cameraX > LEVEL_LENGTH - W) cameraX = LEVEL_LENGTH - W;
}

/* ============================================================
   DRAWING
============================================================ */
function drawPlatforms() {
  for (const p of platforms) {
    ctx.fillStyle = "#8b5cf6";
    const screenX = p.x - cameraX;
    let yTop = p.y;
    const yBottom = p.y + p.h;

    // Subtle wiggle + glow for platforms that are about to drop.
    if (p.drop && p.dropActive && !p.dropping) {
      const t = currentTime || 0;
      const wiggle = Math.sin(t * 20 + screenX * 0.05) * 1.5;
      yTop += wiggle;
      ctx.fillStyle = "#a855f7";
    }

    if (p.bend) {
      const jointX = screenX + p.w * p.bend.joint;
      const bendH = p.bend.bendHeight;

      ctx.beginPath();
      // top edge: left → joint (bent) → right
      ctx.moveTo(screenX, yTop);
      ctx.lineTo(jointX, yTop + bendH);
      ctx.lineTo(screenX + p.w, yTop);
      // bottom edge: right → joint (bent) → left
      ctx.lineTo(screenX + p.w, yBottom);
      ctx.lineTo(jointX, yBottom + bendH);
      ctx.lineTo(screenX, yBottom);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(screenX, yTop, p.w, p.h);
    }
  }
}

function drawCheckpoints() {
  for (let i = 0; i < checkpointDefs.length; i++) {
    const cp = checkpointDefs[i];
    const p = platforms[cp.platformIndex];
    if (!p) continue;
    const poleCenterX = p.x + p.w * cp.offset;
    const poleLeft = poleCenterX - POLE_W / 2;
    const poleTop = p.y - POLE_H;
    const sx = poleLeft - cameraX;
    if (sx < -POLE_W - 20 || sx > W + 20) continue;

    ctx.save();

    // Pole (vertical bar)
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(sx, poleTop, POLE_W, POLE_H);
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, poleTop, POLE_W, POLE_H);

    // Cap / top (flag-like)
    ctx.fillStyle = "#718096";
    ctx.beginPath();
    ctx.moveTo(sx, poleTop + 6);
    ctx.lineTo(sx + POLE_W / 2, poleTop);
    ctx.lineTo(sx + POLE_W, poleTop + 6);
    ctx.lineTo(sx + POLE_W / 2, poleTop + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2d3748";
    ctx.stroke();

    // Highlight if this is the current respawn checkpoint
    if (i === lastCheckpointIndex) {
      ctx.strokeStyle = "rgba(255, 220, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, poleTop - 1, POLE_W + 2, POLE_H + 2);
    }

    ctx.restore();
  }
}

function drawSlimes() {
  for (const s of slimes) {
    if (s.dead) continue;
    // Body
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(s.x - cameraX, s.y, s.w, s.h);
    // Eyes
    ctx.fillStyle = "#000";
    const eyeY = s.y + 5;
    ctx.fillRect(s.x - cameraX + 4, eyeY, 3, 3);
    ctx.fillRect(s.x - cameraX + s.w - 7, eyeY, 3, 3);
  }
}

function drawBats() {
  for (const b of bats) {
    const sx = b.x - cameraX;
    if (sx < -b.w - 20 || sx > W + 20) continue;

    const cx = sx + b.w / 2;
    const cy = b.y + b.h / 2;

    ctx.save();

    // Left wing (filled bat-wing shape: shoulder -> tip -> curve back)
    ctx.fillStyle = "#1e1e28";
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 2);
    ctx.quadraticCurveTo(cx - 18, cy + 2, cx - 12, cy + 10);
    ctx.quadraticCurveTo(cx - 6, cy + 6, cx - 4, cy - 2);
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 2);
    ctx.quadraticCurveTo(cx + 18, cy + 2, cx + 12, cy + 10);
    ctx.quadraticCurveTo(cx + 6, cy + 6, cx + 4, cy - 2);
    ctx.fill();

    // Body and head (single rounded shape)
    ctx.fillStyle = "#2d2d3a";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, b.h / 2 + 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears (small triangles)
    ctx.fillStyle = "#2d2d3a";
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 6);
    ctx.lineTo(cx - 2, cy - 10);
    ctx.lineTo(cx, cy - 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 2, cy - 10);
    ctx.lineTo(cx + 4, cy - 6);
    ctx.fill();

    // Eyes (white with dark pupil)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 2, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f0f14";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 0.8, 0, Math.PI * 2);
    ctx.arc(cx + 2, cy - 3, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawCrawlers() {
  for (const c of crawlers) {
    if (c.dead) continue;
    const screenX = c.x - cameraX;
    if (screenX + c.w < -20 || screenX > W + 20) continue;
    const cx = screenX + c.w / 2;
    const cy = c.y + c.h / 2;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.ellipse(cx, cy, c.w / 2 - 1, c.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCeilingAndStalactites() {
  // Ceiling fill
  if (ceilingPoints.length > 1) {
    ctx.fillStyle = "#5b3f86";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);

    // Walk ceiling polyline from right to left so we close a polygon.
    for (let i = ceilingPoints.length - 1; i >= 0; i--) {
      const p = ceilingPoints[i];
      const sx = p.x - cameraX;
      if (sx < -100 || sx > W + 100) continue;
      ctx.lineTo(sx, p.y);
    }

    ctx.closePath();
    ctx.fill();
  }

  // Stalactites as small triangles hanging from the ceiling.
  ctx.fillStyle = "#3f2b63";
  stalactites.forEach(st => {
    const baseX = st.x - cameraX;
    const topY = st.y;
    const w = st.w;
    const tipY = topY + st.length;

    ctx.beginPath();
    ctx.moveTo(baseX - w / 2, topY);
    ctx.lineTo(baseX + w / 2, topY);
    ctx.lineTo(baseX, tipY);
    ctx.closePath();
    ctx.fill();
  });
}

function drawLava() {
  ctx.fillStyle = "#ff4b3e";
  ctx.fillRect(lava.x - cameraX, lava.y, lava.w, lava.h);
}

function drawGoal() {
  ctx.fillStyle = "#ffd93d";
  ctx.fillRect(goal.x - cameraX, goal.y, goal.w, goal.h);
}

function drawDots() {
  const size = 3.2;
  for (let i = 0; i < dotDefs.length; i++) {
    if (dotsCollected[i]) continue;
    const d = dotDefs[i];
    const sx = d.x - cameraX;
    if (sx + size + 2 < 0 || sx - size - 2 > W) continue;
    const sy = d.y;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = "#e879f9";
    ctx.strokeStyle = "#c026d3";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawItems() {
  const t = (performance.now() / 1000) * 2;
  for (const item of itemDefs) {
    if (item.type === "fireTotem") {
      if (fireTotemCollected) continue;
      const sx = item.x - cameraX;
      if (sx < -item.w - 40 || sx > W + 40) continue;
      const cx = sx + item.w / 2;
      const baseY = item.y + item.h;
      ctx.save();
      // Totem pole (stone)
      ctx.fillStyle = "#5c4a3a";
      ctx.fillRect(sx + 4, item.y + 8, item.w - 8, item.h - 8);
      ctx.fillStyle = "#6b5a4a";
      ctx.fillRect(sx + 6, item.y + 10, item.w - 12, 4);
      ctx.fillRect(sx + 6, item.y + item.h - 18, item.w - 12, 4);
      // Flame on top
      const flamePulse = 0.7 + 0.3 * Math.sin(t * 4);
      const g = ctx.createRadialGradient(cx, item.y + 6, 0, cx, item.y + 6, 12 * flamePulse);
      g.addColorStop(0, "#fff8a0");
      g.addColorStop(0.4, "#ffb84d");
      g.addColorStop(0.8, "#ff6b35");
      g.addColorStop(1, "rgba(255, 60, 20, 0.4)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, item.y + 6, 10 * flamePulse, 14 * flamePulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (item.type !== "lavaBounce" || lavaBounceItemCollected) continue;
    const sx = item.x - cameraX;
    if (sx < -item.w - 40 || sx > W + 40) continue;

    const cx = sx + item.w / 2;
    const cy = item.y + item.h / 2;

    ctx.save();

    // Shimmer rings (pulsing)
    const pulse = 0.5 + 0.3 * Math.sin(t * 3);
    for (let r = 12; r <= 22; r += 5) {
      ctx.strokeStyle = `rgba(255, 180, 80, ${0.25 * pulse * (1 - (r - 12) / 15)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + Math.sin(t * 2 + r) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core: flame-shield orb
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    g.addColorStop(0, "#fff8b0");
    g.addColorStop(0.4, "#ffb84d");
    g.addColorStop(0.8, "#ff6b35");
    g.addColorStop(1, "rgba(255, 80, 40, 0.3)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 220, 150, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }
}

function drawLavaBounceAura() {
  const cx = dragon.x + dragon.w / 2 - cameraX;
  const cy = dragon.y + dragon.h / 2;
  const t = performance.now() / 120;
  ctx.save();

  for (let i = 0; i < 3; i++) {
    const phase = (t + i * 0.33) % 1;
    const r = 22 + phase * 8 + Math.sin(t * 2 + i) * 2;
    const alpha = 0.15 * (1 - phase) * (0.6 + 0.4 * Math.sin(t * 4 + i * 2));
    ctx.strokeStyle = `rgba(255, 200, 100, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// Mouth extends 6px past the nominal body box (snout/horn in dragon drawing).
const DRAGON_MOUTH_OVERHANG = 6;
// When facing left, hitboxes are shifted backward (right) so they sit on the dragon; 1.5 * (body + mouth box).
const HITBOX_LEFT_BACKWARD_SHIFT = Math.round(1.5 * (dragon.w + 2 * 6));
// Mouth hitbox half-width (full width = 2 * this); kept smaller so it doesn't reach out too far.
const DOT_MOUTH_HALF_W = 6;

// Draw one dragon at world position (wx, wy) with facing and alpha (for trail).
// hasFireBreath: when true, dragon is tinted orange/red and has a small chest glow.
// drawFlame: when true, draw fire breath in local coords so it stays attached to the mouth.
function drawDragonAt(wx, wy, facing, alpha, hasFireBreath, drawFlame) {
  const w = dragon.w;
  const h = dragon.h;
  const sx = wx - cameraX;
  const dir = facing === 1 ? 1 : -1;
  const fire = !!hasFireBreath;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Origin at dragon's base-left for drawing; we'll translate to (sx, wy).
  ctx.translate(sx, wy);

  if (dir === -1) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
  }

  // ---- Tail (long, tapering, curves behind)
  ctx.fillStyle = fire ? "#b85c20" : "#4a9b4a";
  ctx.beginPath();
  ctx.moveTo(4, h - 4);
  ctx.quadraticCurveTo(-14, h - 2, -18, h - 8);
  ctx.quadraticCurveTo(-10, h - 6, 4, h - 4);
  ctx.fill();
  ctx.fillStyle = fire ? "#9a4a18" : "#3d853d";
  ctx.beginPath();
  ctx.moveTo(4, h - 4);
  ctx.quadraticCurveTo(-8, h - 4, -12, h - 7);
  ctx.fill();

  // ---- Body (rounded barrel, darker back)
  ctx.fillStyle = fire ? "#c9702a" : "#5ab35a";
  ctx.beginPath();
  ctx.ellipse(14, h / 2 + 2, 10, h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fire ? "#e08840" : "#6bd96b";
  ctx.beginPath();
  ctx.ellipse(14, h / 2 + 3, 8, h / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belly patch (brighter when fire-charged)
  ctx.fillStyle = fire ? "#f0a050" : "#8ee08e";
  ctx.beginPath();
  ctx.ellipse(14, h / 2 + 4, 6, h / 2 - 6, 0, 0, Math.PI);
  ctx.fill();
  if (fire) {
    ctx.fillStyle = "rgba(255, 180, 80, 0.35)";
    ctx.beginPath();
    ctx.ellipse(16, h / 2 + 2, 5, h / 2 - 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Neck (connects body to head)
  ctx.fillStyle = fire ? "#e08840" : "#6bd96b";
  ctx.beginPath();
  ctx.moveTo(20, h / 2 - 2);
  ctx.quadraticCurveTo(28, 4, 32, 2);
  ctx.lineTo(30, h / 2 + 2);
  ctx.quadraticCurveTo(24, h / 2, 20, h / 2 - 2);
  ctx.fill();

  // ---- Head (snout, brow, jaw)
  ctx.fillStyle = fire ? "#c9702a" : "#5ab35a";
  ctx.beginPath();
  ctx.moveTo(28, 6);
  ctx.lineTo(w + 4, 8);
  ctx.lineTo(w + 2, 14);
  ctx.lineTo(30, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = fire ? "#e08840" : "#6bd96b";
  ctx.beginPath();
  ctx.moveTo(30, 8);
  ctx.quadraticCurveTo(w, 10, w + 2, 12);
  ctx.lineTo(30, 12);
  ctx.closePath();
  ctx.fill();

  // ---- Horn (small, on nose)
  ctx.fillStyle = "#7a6b4a";
  ctx.beginPath();
  ctx.moveTo(w + 2, 6);
  ctx.lineTo(w + 6, 2);
  ctx.lineTo(w + 4, 8);
  ctx.closePath();
  ctx.fill();

  // ---- Eye
  ctx.fillStyle = fire ? "#fff0b0" : "#f9f3c2";
  ctx.beginPath();
  ctx.arc(26, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a14";
  ctx.beginPath();
  ctx.arc(27, 8, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- Nostril
  ctx.fillStyle = fire ? "#9a4a18" : "#3d853d";
  ctx.beginPath();
  ctx.arc(w - 2, 12, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- Front leg (one visible)
  ctx.fillStyle = fire ? "#b85c20" : "#4a9b4a";
  ctx.fillRect(18, h - 4, 4, 6);
  ctx.fillStyle = fire ? "#9a4a18" : "#3d853d";
  ctx.beginPath();
  ctx.ellipse(20, h + 2, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- Fire breath (in local coords so it stays attached to the mouth when facing either way)
  if (drawFlame) {
    const flameLen = 50;
    const flameY = 4;
    const flameH = h - 8;
    // When facing left, start flame slightly in from the snout tip so it matches facing-right distance
    const mouthX = dir === 1 ? w : w + 2;
    const flameX = mouthX;
    const flameW = flameLen;
    const t = performance.now() / 80;
    const g = ctx.createLinearGradient(flameX, 0, flameX + flameW, 0);
    if (dir === -1) {
      g.addColorStop(1, "rgba(255, 200, 80, 0.85)");
      g.addColorStop(0.6, "rgba(255, 120, 40, 0.7)");
      g.addColorStop(0.2, "rgba(255, 60, 20, 0.4)");
      g.addColorStop(0, "rgba(255, 40, 10, 0)");
    } else {
      g.addColorStop(0, "rgba(255, 200, 80, 0.85)");
      g.addColorStop(0.4, "rgba(255, 120, 40, 0.7)");
      g.addColorStop(0.8, "rgba(255, 60, 20, 0.4)");
      g.addColorStop(1, "rgba(255, 40, 10, 0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(flameX, flameY, flameW, flameH);
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.4 + 0.2 * Math.sin(t);
    ctx.fillStyle = "#fff8c0";
    const overlayW = flameW * 0.6;
    const overlayX = dir === 1 ? flameX : flameX + flameW - overlayW;
    ctx.fillRect(overlayX, flameY + 2, overlayW, flameH - 4);
    ctx.globalAlpha = prevAlpha;
  }

  ctx.restore();
}

function drawDragonTrail() {
  if (dragonTrail.length === 0) return;
  const n = dragonTrail.length;
  for (let i = 0; i < n; i++) {
    const t = dragonTrail[i];
    const alpha = 0.08 + (i / n) * 0.35; // older = more transparent
    drawDragonAt(t.x, t.y, t.facing, alpha, false, false);
  }
}

function drawDragon() {
  drawDragonTrail();

  // When lava bounce is active, blink: slow at first, faster as timer runs out
  let drawMainDragon = true;
  if (lavaBounceTimer > 0) {
    const elapsed = 5 - lavaBounceTimer;
    const interval = 0.1 + 0.7 * (lavaBounceTimer / 5);
    const cyclePhase = elapsed % interval;
    const blinkOffDuration = 0.08;
    drawMainDragon = cyclePhase >= blinkOffDuration;
  }

  if (drawMainDragon) {
    drawDragonAt(dragon.x, dragon.y, dragon.facing, 1, fireBreathsLeft > 0, breathActiveTime > 0);
  }
  if (lavaBounceTimer > 0) drawLavaBounceAura();
}

function drawHUD() {
  const hasFire = fireBreathsLeft > 0;
  const hudH = hasFire ? 150 : 132;
  ctx.fillStyle = "#00000088";
  ctx.fillRect(10, 10, 260, hudH);

  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Time: " + currentTime.toFixed(2), 20, 35);

  if (bestScore !== Infinity) {
    ctx.fillText("Best: " + bestScore.toFixed(2), 20, 55);
  } else {
    ctx.fillText("Best: --", 20, 55);
  }

  ctx.fillText("Dots: " + dotsCollectedCount + "/" + NUM_DOTS, 20, 75);

  ctx.fillText("Lives: " + "♥".repeat(lives) + "♡".repeat(LIVES_START - lives), 20, 95);

  const displayDiff = currentDifficulty != null
    ? Math.max(1, Math.min(30, Math.floor(currentDifficulty)))
    : null;
  const levelLabel = currentLevelSeed != null && currentLevelSeed > 0
    ? String(currentLevelSeed)
    : (currentLevelID || "--");
  let levelText = "Level: " + levelLabel;
  if (displayDiff != null) levelText += "  (Diff " + displayDiff + ")";
  ctx.fillText(levelText, 20, 115);

  if (hasFire) {
    ctx.fillStyle = "#ffb84d";
    ctx.fillText("Flame shield (G)", 20, 135);
  }
}

function drawWinMessage() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  // Stats and actions are in the HTML win overlay
}

function updateWinOverlay() {
  const el = document.getElementById("winOverlay");
  if (!el) return;
  if (gameWon) {
    el.style.display = "flex";
    const timeEl = document.getElementById("winTime");
    const dotsEl = document.getElementById("winDots");
    const bestEl = document.getElementById("winBest");
    if (timeEl) timeEl.textContent = "Time: " + currentTime.toFixed(2) + "s";
    if (dotsEl) dotsEl.textContent = dotsCollectedCount + "/" + NUM_DOTS;
    if (bestEl) {
      if (bestScore !== Infinity && Math.abs(currentTime - bestScore) < 0.01) {
        bestEl.textContent = "New best!";
      } else if (bestScore !== Infinity) {
        bestEl.textContent = "Best: " + bestScore.toFixed(2) + "s";
      } else {
        bestEl.textContent = "Best: --";
      }
    }
    const nextBtn = document.getElementById("winNextLevelBtn");
    const data = loadAllLevels();
    if (nextBtn && data.levels && data.levels.length > 0) {
      const idx = data.levels.findIndex(l => l.id === currentLevelID);
      nextBtn.style.display = "";
      nextBtn.textContent = (idx >= 0 && idx < data.levels.length - 1) ? "Next level →" : "First level →";
    }
  } else {
    el.style.display = "none";
  }
}

/* ============================================================
   FPS BENCHMARK (runs once at startup to measure device capability)
============================================================ */
let measuredFPS = REFERENCE_FPS;
const BENCHMARK_DURATION_MS = 400;
const BENCHMARK_MIN_FRAMES = 20;

function runFPSBenchmark(callback) {
  let frameCount = 0;
  const t0 = performance.now();
  function measureFrame(t) {
    frameCount++;
    const elapsed = t - t0;
    if (elapsed >= BENCHMARK_DURATION_MS || frameCount >= 60) {
      measuredFPS = frameCount / (elapsed / 1000);
      if (measuredFPS < 20) measuredFPS = 20;
      if (measuredFPS > 120) measuredFPS = 120;
      if (typeof callback === "function") callback();
      return;
    }
    requestAnimationFrame(measureFrame);
  }
  requestAnimationFrame(measureFrame);
}

/* ============================================================
   MAIN LOOP (delta-time: 1 real second = 1 game second on all devices)
============================================================ */
const DT_CAP = 0.05; // max 50ms per frame to avoid spiral of death on lag spikes
let lastFrameTime = 0;

function loop(timestamp) {
  if (typeof timestamp !== "number") {
    timestamp = performance.now();
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  let deltaMs = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  const dt = Math.min(deltaMs / 1000, DT_CAP);

  ctx.clearRect(0, 0, W, H);

  drawCeilingAndStalactites();
  drawPlatforms();
  drawCheckpoints();
  drawLava();
  drawGoal();
  drawItems();
  drawDots();
  drawSlimes();
  drawBats();
  drawCrawlers();
  update(dt);
  drawDragon();
  drawHUD();

  if (gameWon) {
    drawWinMessage();
    updateWinOverlay();
  } else {
    updateWinOverlay();
  }

  requestAnimationFrame(loop);
}

/* ============================================================
   LEVEL SELECT UI
============================================================ */
function populateLevelDropdown() {
  const select = document.getElementById("levelSelect");
  const data = loadAllLevels();

  select.innerHTML = "";

  const optNew = document.createElement("option");
  optNew.value = "new";
  optNew.textContent = "New Random Level";
  select.appendChild(optNew);

  data.levels.forEach(lvl => {
    const opt = document.createElement("option");
    opt.value = lvl.id;
    const best =
      typeof lvl.bestScore === "number" && isFinite(lvl.bestScore)
        ? `${lvl.bestScore.toFixed(2)}s`
        : "--";
    const bestDots = typeof lvl.bestDots === "number" && lvl.bestDots > 0
      ? `${lvl.bestDots}/${NUM_DOTS}`
      : "--";
    opt.textContent = `${lvl.name} (Best: ${best}, Dots: ${bestDots})`;
    select.appendChild(opt);
  });
}

document.getElementById("levelSelect").addEventListener("change", e => {
  const value = e.target.value;
  const data = loadAllLevels();

  if (value === "new") {
    generateRandomLevel();
    resetPlayerToStart();
    return;
  }

  const level = data.levels.find(l => l.id === value);
  if (level) loadLevel(level);
});

document.getElementById("newLevelBtn").addEventListener("click", () => {
  generateRandomLevel();
  resetPlayerToStart();
});

document.getElementById("shareBtn").addEventListener("click", () => {
  const seed = currentLevelSeed;
  if (seed == null || seed <= 0) {
    alert("This level cannot be shared by link.");
    return;
  }
  const difficulty = currentDifficulty != null ? Math.max(1, Math.min(30, Math.floor(currentDifficulty))) : null;
  const hash = seed + (difficulty != null ? "/" + difficulty : "");
  const url = location.origin + location.pathname + "#" + hash;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("shareBtn");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    prompt("Copy this link:", url);
  });
});

document.getElementById("winNextLevelBtn").addEventListener("click", () => {
  const data = loadAllLevels();
  if (!data.levels.length) return;
  const idx = data.levels.findIndex(l => l.id === currentLevelID);
  const nextLevel = (idx >= 0 && idx < data.levels.length - 1)
    ? data.levels[idx + 1]
    : data.levels[0];
  loadLevel(nextLevel);
});

document.getElementById("winReplayBtn").addEventListener("click", () => {
  lastCheckpointIndex = -1; // replay from the beginning, not from last checkpoint
  lives = LIVES_START;
  resetPlayerToStart();
});

/* ============================================================
   STARTUP + HASH ROUTING
============================================================ */
function syncUrlToSeed() {
  if (skipNextHashChange) return;
  if (currentLevelSeed != null && currentLevelSeed > 0) {
    // Include difficulty so refresh and shared links reproduce the exact same level.
    const difficulty = currentDifficulty != null ? Math.max(1, Math.min(30, Math.floor(currentDifficulty))) : null;
    const newHash = "#" + currentLevelSeed + (difficulty != null ? "/" + difficulty : "");
    if (location.hash !== newHash) {
      skipNextHashChange = true;
      location.hash = currentLevelSeed + (difficulty != null ? "/" + difficulty : "");
    }
  } else {
    if (location.hash !== "") {
      skipNextHashChange = true;
      location.hash = "";
    }
  }
}

function loadLevelFromHash() {
  if (skipNextHashChange) {
    skipNextHashChange = false;
    return false;
  }
  const hash = location.hash.slice(1).trim();
  if (!hash) return false;
  const parts = hash.split("/");
  const hashSeed = parseInt(parts[0], 10);
  const hashDifficulty = parts.length > 1 ? parseInt(parts[1], 10) : 15;
  if (!isNaN(hashSeed) && hashSeed > 0) {
    const difficulty = !isNaN(hashDifficulty) && hashDifficulty >= 1 && hashDifficulty <= 30 ? hashDifficulty : 15;
    generateLevelFromSeed(hashSeed, difficulty);
    lives = LIVES_START;
    resetPlayerToStart();
    return true;
  }
  return false;
}

window.addEventListener("hashchange", () => {
  loadLevelFromHash();
});

populateLevelDropdown();

if (!loadLevelFromHash()) {
  generateRandomLevel();
  resetPlayerToStart();
}

// Start game loop immediately; delta-time keeps speed consistent across devices.
requestAnimationFrame(loop);
// Run FPS benchmark in background so measuredFPS is available (e.g. for future tuning or debug).
runFPSBenchmark();

