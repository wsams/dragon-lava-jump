/**
 * Dragon Lava Jump - Phaser 3 port.
 * Single script (no ES modules) so it runs from file:// or any simple server.
 * Uses fixed hitbox for player: body size/offset do not depend on facing (no swing death).
 */
(function () {
  "use strict";

  // --- Constants (match legacy for physics and layout)
  var LEVEL_LENGTH = 4000;
  var REFERENCE_FPS = 60;
  var WORLD_H = 360;
  var gravity = 0.5 * REFERENCE_FPS * REFERENCE_FPS;
  var moveSpeed = 3.5 * REFERENCE_FPS;
  var jumpStrength = 10 * REFERENCE_FPS;
  var NUM_DOTS = 30;
  var DOT_R = 3.5;
  var DOT_SAFETY_MARGIN = 15;
  var SLIME_AVOID_BAND = 0.28;
  var POLE_W = 12;
  var POLE_H = 40;
  var LIVES_START = 3;
  var SLIME_JUMP_STRENGTH = 7 * REFERENCE_FPS;
  var BAT_W = 24;
  var BAT_H = 16;
  var BAT_MAX_SPEED = 2.2 * REFERENCE_FPS;
  var BAT_WANDER_STRENGTH = 0.5 * REFERENCE_FPS;
  var CRAWLER_W = 20;
  var CRAWLER_H = 14;
  var CRAWLER_PERIMETER_SPEED = 0.004 * REFERENCE_FPS;
  var DRAGON_W = 30;
  var DRAGON_H = 26;
  var DRAGON_MOUTH_OVERHANG = 6;
  var BREATH_LEN = 50;
  var BOOST_AIR_DELAY_SEC = 6 / REFERENCE_FPS;
  var BOOST_DURATION_SEC = 12 / REFERENCE_FPS;
  var BOOST_POWER_H = (64 / 12) * REFERENCE_FPS * REFERENCE_FPS;
  var BOOST_POWER_V = (6 / 12) * REFERENCE_FPS * REFERENCE_FPS;
  var maxUpwardVy = -jumpStrength - 0.5 * REFERENCE_FPS;
  var LAVA_BOUNCE_VY = -18;
  var LAVA_DEATH_DURATION = 35 / REFERENCE_FPS;

  // --- RNG
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function rngRange(rng, min, max) {
    return min + rng() * (max - min);
  }

  // --- Level generation (ported from legacy levelGen.js)
  function generateCeilingAndStalactites(difficulty, seed, platforms) {
    var rng = makeRng(seed);
    var pts = [];
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var t = (dClamped - 1) / 29;
    var step = 120;
    var x = 0;
    var baseY = 30;
    var amp = 8 + t * 22;
    while (x <= LEVEL_LENGTH) {
      var y = baseY + rngRange(rng, -amp, amp);
      y = Math.max(10, Math.min(70, y));
      pts.push({ x: x, y: y });
      baseY = baseY * 0.7 + y * 0.3;
      x += step;
    }
    var stalDefs = [];
    var maxStals = 3 + Math.floor(dClamped / 4);
    var available = pts.slice(1, pts.length - 1);
    for (var i = 0; i < maxStals && available.length > 0; i++) {
      var idx = Math.floor(rng() * available.length);
      var p = available.splice(idx, 1)[0];
      var w = 18 + rng() * 8;
      var lenMin = 18 + t * 6;
      var lenMax = 34 + t * 10;
      var length = rngRange(rng, lenMin, lenMax);
      if (Array.isArray(platforms) && platforms.length) {
        var nearestY = Infinity;
        for (var pi = 0; pi < platforms.length; pi++) {
          var plat = platforms[pi];
          if (!plat) continue;
          if (p.x >= plat.x && p.x <= plat.x + plat.w && plat.y > p.y && plat.y < nearestY)
            nearestY = plat.y;
        }
        if (nearestY < Infinity) {
          var clearance = 26 * (3.0 - 0.5 * t) + 16;
          var maxAllowed = nearestY - p.y - clearance;
          if (maxAllowed <= 26) continue;
          length = Math.min(length, maxAllowed);
        }
      }
      stalDefs.push({ x: p.x, y: p.y, length: length, w: w });
    }
    return { ceilingPoints: pts, stalactites: stalDefs };
  }

  function pickBatCountForDifficulty(difficulty) {
    if (difficulty <= 8) return 1;
    if (difficulty <= 16) return 2;
    if (difficulty <= 24) return 3;
    return 4;
  }
  function generateBats(difficulty, seed, H) {
    var rng = makeRng(seed);
    var count = pickBatCountForDifficulty(difficulty);
    var defs = [];
    var marginX = 250;
    var yMin = 100;
    var yMax = H - 150;
    for (var i = 0; i < count; i++) {
      defs.push({
        x: rngRange(rng, marginX, LEVEL_LENGTH - marginX),
        y: rngRange(rng, yMin, yMax),
        rngSeed: seed + 777 + i
      });
    }
    return defs;
  }
  function generateLavaBounceItem(seed, H) {
    var rng = makeRng(seed);
    return [{
      type: "lavaBounce",
      x: LEVEL_LENGTH / 2 + rngRange(rng, -80, 80),
      y: H - 220 + rngRange(rng, -30, 30),
      w: 28,
      h: 28
    }];
  }
  function generateFireTotemItem(seed, H) {
    var rng = makeRng(seed);
    return [{
      type: "fireTotem",
      x: LEVEL_LENGTH / 4 + rngRange(rng, -60, 60),
      y: H - 200 + rngRange(rng, -40, 20),
      w: 24,
      h: 36
    }];
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
  function generateSlimesForPlatforms(platforms, difficulty, seed) {
    var rng = makeRng(seed);
    var indices = [];
    for (var i = 1; i < platforms.length; i++) indices.push(i);
    if (!indices.length) return [];
    var maxSlimes = pickSlimeCountForDifficulty(difficulty);
    var count = Math.min(maxSlimes, indices.length);
    var defs = [];
    for (var n = 0; n < count; n++) {
      var pick = Math.floor(rng() * indices.length);
      var platformIndex = indices.splice(pick, 1)[0];
      defs.push({
        platformIndex: platformIndex,
        offset: rngRange(rng, 0.2, 0.8),
        delay: Math.floor(60 + rng() * 120)
      });
    }
    return defs;
  }
  function generateCheckpoints(platforms, slimeDefs, seed) {
    var slimePlatformIndices = new Set((slimeDefs || []).map(function (s) { return s.platformIndex; }));
    var candidates = platforms
      .map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) { return x.i > 0 && !slimePlatformIndices.has(x.i); });
    if (candidates.length < 2) return [];
    var target1 = LEVEL_LENGTH / 3;
    var target2 = (LEVEL_LENGTH * 2) / 3;
    var center = function (a) { return a.p.x + a.p.w / 2; };
    var byDist1 = candidates.slice().sort(function (a, b) { return Math.abs(center(a) - target1) - Math.abs(center(b) - target1); });
    var byDist2 = candidates.slice().sort(function (a, b) { return Math.abs(center(a) - target2) - Math.abs(center(b) - target2); });
    var idx1 = byDist1[0].i;
    var idx2 = byDist2[0].i;
    if (idx1 === idx2 && candidates.length >= 2) idx2 = byDist2[1].i;
    return [{ platformIndex: idx1, offset: 0.5 }, { platformIndex: idx2, offset: 0.5 }];
  }
  function pickCrawlerCountForDifficulty(difficulty) {
    if (difficulty <= 5) return 1;
    if (difficulty <= 15) return 2;
    return 3;
  }
  function generateCrawlers(platforms, slimeDefs, difficulty, seed) {
    var rng = makeRng(seed);
    var slimePlatforms = new Set((slimeDefs || []).map(function (s) { return s.platformIndex; }));
    var candidates = platforms
      .map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) { return x.i > 0 && !slimePlatforms.has(x.i); });
    if (!candidates.length) return [];
    var count = Math.min(pickCrawlerCountForDifficulty(difficulty), candidates.length);
    var defs = [];
    var used = new Set();
    for (var n = 0; n < count; n++) {
      var idx = Math.floor(rng() * candidates.length);
      var tries = candidates.length;
      while (used.has(idx) && tries--) idx = (idx + 1) % candidates.length;
      if (used.has(idx)) continue;
      used.add(idx);
      defs.push({ platformIndex: candidates[idx].i, offset: rng() });
    }
    return defs;
  }
  function generateDots(platforms, seed, goal, slimeDefs, crawlerDefs) {
    var dots = [];
    var maxX = (goal && typeof goal.x === "number") ? goal.x - DOT_SAFETY_MARGIN : LEVEL_LENGTH - 50;
    var crawlerPlatforms = new Set((crawlerDefs || []).map(function (c) { return c.platformIndex; }));
    var slimeByPlatform = new Map();
    (slimeDefs || []).forEach(function (s) { slimeByPlatform.set(s.platformIndex, s); });
    var safePlatforms = (platforms || []).map(function (p, i) { return { p: p, i: i }; }).filter(
      function (x) { return x.p && x.p.w > 12 && x.p.x < maxX && !crawlerPlatforms.has(x.i); }
    );
    var segments = [];
    for (var si = 0; si < safePlatforms.length; si++) {
      var sp = safePlatforms[si];
      var p = sp.p;
      var i = sp.i;
      var left = p.x + 8;
      var right = Math.min(p.x + p.w - 8, maxX - 4);
      var y = p.y - 6;
      var slime = slimeByPlatform.get(i);
      if (slime && right > left) {
        var avoidL = Math.max(left, p.x + p.w * (slime.offset - SLIME_AVOID_BAND));
        var avoidR = Math.min(right, p.x + p.w * (slime.offset + SLIME_AVOID_BAND));
        if (avoidL > left) segments.push({ left: left, right: avoidL, y: y });
        if (right > avoidR) segments.push({ left: avoidR, right: right, y: y });
      } else if (right > left) {
        segments.push({ left: left, right: right, y: y });
      }
    }
    var totalLen = segments.reduce(function (s, seg) { return s + (seg.right - seg.left); }, 0);
    if (totalLen <= 0 || segments.length === 0) return dots;
    for (var j = 0; j < NUM_DOTS; j++) {
      var t = (j + 0.5) / NUM_DOTS;
      var targetPos = t * totalLen;
      var acc = 0;
      for (var k = 0; k < segments.length; k++) {
        var seg = segments[k];
        var len = seg.right - seg.left;
        if (acc + len >= targetPos) {
          dots.push({ x: seg.left + (targetPos - acc), y: seg.y });
          break;
        }
        acc += len;
      }
    }
    return dots;
  }

  function generateDefaultLevelLayout(difficulty, seed, H) {
    var rng = makeRng(seed);
    var platforms = [];
    var start = { x: 40, y: H - 140, w: 180, h: 16 };
    platforms.push(start);
    var maxPlatforms = 16 + Math.floor(difficulty * 0.7);
    var x = start.x + start.w + 70;
    var baseY = H - 150;
    var gapMin = 90 + difficulty * 4;
    var gapMax = 130 + difficulty * 8;
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var t = (dClamped - 1) / 29;
    var easyMin = 140, easyMax = 220;
    var hardMin = easyMin * 0.5, hardMax = easyMax * 0.5;
    var globalMin = easyMin + (hardMin - easyMin) * t;
    var globalMax = easyMax + (hardMax - easyMax) * t;
    var shortProb = 0.2 + 0.6 * t;
    var shortMin = globalMin * 0.6, shortMax = globalMin;
    var longMin = globalMin, longMax = globalMax * 1.1;
    var vertAmp = 40 + difficulty * 3;
    for (var i = 0; i < maxPlatforms; i++) {
      var gap = rngRange(rng, gapMin, gapMax);
      x += gap;
      if (x > LEVEL_LENGTH - 260) break;
      var useShort = rng() < shortProb;
      var w = useShort ? rngRange(rng, shortMin, shortMax) : rngRange(rng, longMin, longMax);
      var y = baseY + rngRange(rng, -vertAmp, vertAmp);
      y = Math.max(80, Math.min(H - 180, y));
      var platform = { x: x, y: y, w: w, h: 16 };
      var bendChance = 0.1 + 0.6 * t;
      if (rng() < bendChance) {
        platform.bend = {
          joint: rngRange(rng, 0.25, 0.75),
          bendHeight: (rng() < 0.5 ? -1 : 1) * rngRange(rng, 6, 14)
        };
      }
      platforms.push(platform);
      baseY = baseY * 0.6 + y * 0.4;
    }
    var dropProbBase = 0.06 + 0.18 * t;
    var maxDroppers = Math.max(1, Math.floor((platforms.length - 2) * (0.08 + 0.2 * t)));
    var dropCount = 0;
    for (var di = 1; di < platforms.length - 1 && dropCount < maxDroppers; di++) {
      var pp = platforms[di];
      if (!pp || pp.y > H - 120) continue;
      if (rng() > dropProbBase) continue;
      pp.drop = { delay: 30 + rng() * 45, speed: 2.4 + t * 1.6 };
      dropCount++;
    }
    var last = platforms[platforms.length - 1];
    var goalX = Math.min(LEVEL_LENGTH - 120, last.x + last.w + 80);
    var goal = { x: goalX, y: H - 120, w: 50, h: 80 };
    var cave = generateCeilingAndStalactites(difficulty, seed + 321, platforms);
    var bats = generateBats(difficulty, seed + 777, H);
    var items = generateLavaBounceItem(seed + 888, H).concat(generateFireTotemItem(seed + 999, H));
    var slimes = generateSlimesForPlatforms(platforms, difficulty, seed + 999);
    var checkpoints = generateCheckpoints(platforms, slimes, seed + 111);
    var crawlers = generateCrawlers(platforms, slimes, difficulty, seed + 555);
    var dots = generateDots(platforms, seed + 444, goal, slimes, crawlers);
    return {
      platforms: platforms,
      goal: goal,
      ceilingPoints: cave.ceilingPoints,
      stalactites: cave.stalactites,
      bats: bats,
      items: items,
      dots: dots,
      slimes: slimes,
      checkpoints: checkpoints,
      crawlers: crawlers
    };
  }

  function crawlerPerimeterPosition(p, t) {
    var tw = p.w, th = p.h;
    if (t < 0.25) return { cx: p.x + (t / 0.25) * tw, cy: p.y };
    if (t < 0.5) return { cx: p.x + tw, cy: p.y + ((t - 0.25) / 0.25) * th };
    if (t < 0.75) return { cx: p.x + tw - ((t - 0.5) / 0.25) * tw, cy: p.y + th };
    var f = (t - 0.75) / 0.25;
    return { cx: p.x, cy: p.y + th - f * th };
  }

  // --- Storage
  var LEVELS_STORAGE_KEY = "dragonLevels";
  var DEFAULT_LEVELS = [
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
    { id: "pack-13", name: "13 Dragon's Gauntlet", difficulty: 13, seed: 113 },
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

  function ensureDefaultLevelsSeeded(data, H) {
    if (!data || !Array.isArray(data.levels)) data = { levels: [] };
    var changed = false;
    DEFAULT_LEVELS.forEach(function (meta) {
      var lvl = data.levels.find(function (l) { return l.id === meta.id; });
      if (!lvl) {
        var layout = generateDefaultLevelLayout(meta.difficulty, meta.seed, H);
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
        if (typeof lvl.bestScore !== "number" || !isFinite(lvl.bestScore)) { lvl.bestScore = Infinity; changed = true; }
        if (typeof lvl.bestDots !== "number" || lvl.bestDots < 0) { lvl.bestDots = 0; changed = true; }
        if (lvl.difficulty == null) { lvl.difficulty = meta.difficulty; changed = true; }
        if (!Array.isArray(lvl.slimes)) {
          lvl.slimes = generateSlimesForPlatforms(lvl.platforms, lvl.difficulty || meta.difficulty, meta.seed + 999);
          changed = true;
        }
        if (!Array.isArray(lvl.ceiling) || !Array.isArray(lvl.stalactites)) {
          var cave = generateCeilingAndStalactites(lvl.difficulty || meta.difficulty, meta.seed + 321, lvl.platforms);
          lvl.ceiling = cave.ceilingPoints;
          lvl.stalactites = cave.stalactites;
          changed = true;
        }
        if (!Array.isArray(lvl.bats)) {
          lvl.bats = generateBats(lvl.difficulty || meta.difficulty, meta.seed + 777, H);
          changed = true;
        }
        if (!Array.isArray(lvl.items)) lvl.items = [];
        if (!lvl.items.some(function (i) { return i && i.type === "lavaBounce"; })) {
          lvl.items = lvl.items.concat(generateLavaBounceItem(meta.seed + 888, H));
          changed = true;
        }
        if (!lvl.items.some(function (i) { return i && i.type === "fireTotem"; })) {
          lvl.items = lvl.items.concat(generateFireTotemItem(meta.seed + 999, H));
          changed = true;
        }
        if (!Array.isArray(lvl.dots) || lvl.dots.length !== NUM_DOTS) {
          lvl.dots = generateDots(lvl.platforms || [], meta.seed + 444, lvl.goal, lvl.slimes, lvl.crawlers);
          changed = true;
        }
        if (!Array.isArray(lvl.checkpoints)) {
          lvl.checkpoints = generateCheckpoints(lvl.platforms, lvl.slimes || [], meta.seed + 111);
          changed = true;
        }
        if (!Array.isArray(lvl.crawlers) || lvl.crawlers.length === 0) {
          lvl.crawlers = generateCrawlers(lvl.platforms, lvl.slimes || [], lvl.difficulty || meta.difficulty, meta.seed + 555);
          changed = true;
        }
        var anyBent = Array.isArray(lvl.platforms) && lvl.platforms.some(function (p) { return p && p.bend; });
        if (Array.isArray(lvl.platforms) && !anyBent) {
          var d = lvl.difficulty != null ? lvl.difficulty : meta.difficulty;
          var dClamped = Math.max(1, Math.min(30, d));
          var bendChance = 0.1 + 0.6 * ((dClamped - 1) / 29);
          var rng = makeRng(meta.seed + 555);
          lvl.platforms.forEach(function (p, index) {
            if (!p || index === 0 || p.bend) return;
            if (rng() >= bendChance) return;
            p.bend = {
              joint: 0.25 + rng() * 0.5,
              bendHeight: (rng() < 0.5 ? -1 : 1) * (6 + rng() * 8)
            };
          });
          changed = true;
        }
      }
    });
    if (changed) saveAllLevels(data);
    return data;
  }

  function loadAllLevels(H) {
    H = H || WORLD_H;
    var data;
    try {
      var raw = localStorage.getItem(LEVELS_STORAGE_KEY);
      data = !raw ? { levels: [] } : JSON.parse(raw);
      if (!data || !Array.isArray(data.levels)) data = { levels: [] };
    } catch (e) {
      data = { levels: [] };
    }
    return ensureDefaultLevelsSeeded(data, H);
  }

  function saveAllLevels(data) {
    localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(data));
  }

  function saveCompletedLevel(levelID, name, platforms, goal, bestScore, dotsCollected, levelState, onSaved) {
    var data = loadAllLevels(levelState.H);
    var existing = data.levels.find(function (l) { return l.id === levelID; });
    var dots = typeof dotsCollected === "number" ? dotsCollected : 0;
    if (existing) {
      if (typeof existing.bestScore !== "number" || !isFinite(existing.bestScore)) existing.bestScore = Infinity;
      if (bestScore < existing.bestScore) { existing.bestScore = bestScore; saveAllLevels(data); }
      if (dots > (existing.bestDots || 0)) { existing.bestDots = dots; saveAllLevels(data); }
      return;
    }
    var dotDefs = levelState.dotDefs.length === NUM_DOTS
      ? levelState.dotDefs
      : generateDots(platforms, (levelState.currentLevelSeed || 0) + 444, goal, levelState.slimeDefs, levelState.crawlerDefs);
    data.levels.push({
      id: levelID,
      name: name,
      platforms: platforms,
      goal: goal,
      bestScore: bestScore,
      bestDots: dots,
      difficulty: levelState.currentDifficulty,
      slimes: levelState.slimeDefs,
      ceiling: levelState.ceilingPoints,
      stalactites: levelState.stalactiteDefs,
      bats: levelState.batDefs,
      items: levelState.itemDefs,
      dots: dotDefs,
      checkpoints: levelState.checkpointDefs,
      crawlers: levelState.crawlerDefs
    });
    saveAllLevels(data);
    if (typeof onSaved === "function") onSaved();
  }

  // --- Global input and level data (set by UI, read by scene)
  window.__dragonKeys = { left: false, right: false, jump: false, boost: false, breath: false };
  window.__dragonJumpKeyReleased = true;
  window.__dragonBreathKeyConsumed = false;
  window.__dragonLevelData = null;
  window.__dragonPopulateLevelDropdown = null;

  function buildLevelDataForNewSeed(seed, difficulty) {
    difficulty = difficulty != null ? Math.max(1, Math.min(30, difficulty)) : 15;
    seed = Math.floor(Number(seed)) || 0;
    if (seed <= 0) return null;
    var layout = generateDefaultLevelLayout(difficulty, seed, WORLD_H);
    return {
      currentLevelID: "seed-" + seed,
      currentLevelSeed: seed,
      currentDifficulty: difficulty,
      bestScore: Infinity,
      platforms: layout.platforms,
      goal: layout.goal,
      slimeDefs: layout.slimes,
      ceilingPoints: layout.ceilingPoints,
      stalactiteDefs: layout.stalactites,
      batDefs: layout.bats,
      itemDefs: layout.items,
      dotDefs: layout.dots,
      checkpointDefs: layout.checkpoints,
      crawlerDefs: layout.crawlers
    };
  }

  function buildLevelDataForRandom() {
    var difficulty = Math.floor(Math.random() * (23 - 8 + 1) + 8);
    var seed = Math.floor(Math.random() * 1e9);
    var layout = generateDefaultLevelLayout(difficulty, seed, WORLD_H);
    return {
      currentLevelID: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "rand-" + seed,
      currentLevelSeed: seed,
      currentDifficulty: difficulty,
      bestScore: Infinity,
      platforms: layout.platforms,
      goal: layout.goal,
      slimeDefs: layout.slimes,
      ceilingPoints: layout.ceilingPoints,
      stalactiteDefs: layout.stalactites,
      batDefs: layout.bats,
      itemDefs: layout.items,
      dotDefs: layout.dots,
      checkpointDefs: layout.checkpoints,
      crawlerDefs: layout.crawlers
    };
  }

  function buildLevelDataFromStored(level) {
    var platforms = JSON.parse(JSON.stringify(level.platforms));
    var goal = JSON.parse(JSON.stringify(level.goal));
    var crawlerDefs = Array.isArray(level.crawlers) && level.crawlers.length > 0
      ? level.crawlers
      : generateCrawlers(platforms, level.slimes || [], level.difficulty != null ? level.difficulty : 15, (level.seed != null ? level.seed : 0) + 555);
    var dotDefs = Array.isArray(level.dots) && level.dots.length === NUM_DOTS
      ? level.dots
      : generateDots(platforms, (level.seed != null ? level.seed : 0) + 444, goal, level.slimes || [], crawlerDefs);
    return {
      currentLevelID: level.id,
      currentLevelSeed: level.seed != null ? level.seed : null,
      currentDifficulty: level.difficulty != null ? level.difficulty : null,
      bestScore: level.bestScore,
      platforms: platforms,
      goal: goal,
      slimeDefs: Array.isArray(level.slimes) ? level.slimes : [],
      ceilingPoints: Array.isArray(level.ceiling) ? level.ceiling : [],
      stalactiteDefs: Array.isArray(level.stalactites) ? level.stalactites : [],
      batDefs: Array.isArray(level.bats) ? level.bats : [],
      itemDefs: Array.isArray(level.items) ? level.items : [],
      dotDefs: dotDefs,
      checkpointDefs: Array.isArray(level.checkpoints) ? level.checkpoints : [],
      crawlerDefs: crawlerDefs
    };
  }

  // --- Phaser scene
  var GameScene = function () {
    Phaser.Scene.call(this, { key: "Game" });
  };
  GameScene.prototype = Object.create(Phaser.Scene.prototype);
  GameScene.prototype.constructor = GameScene;

  GameScene.prototype.create = function () {
    var data = window.__dragonLevelData;
    if (!data) {
      data = buildLevelDataForRandom();
      window.__dragonLevelData = data;
    }

    this.LEVEL_LENGTH = LEVEL_LENGTH;
    this.WORLD_H = WORLD_H;
    this.platformsData = data.platforms;
    this.basePlatformsData = JSON.parse(JSON.stringify(data.platforms));
    this.goal = data.goal;
    this.slimeDefs = data.slimeDefs;
    this.ceilingPoints = data.ceilingPoints || [];
    this.stalactiteDefs = data.stalactiteDefs || [];
    this.batDefs = data.batDefs || [];
    this.itemDefs = data.itemDefs || [];
    this.dotDefs = data.dotDefs || [];
    this.checkpointDefs = data.checkpointDefs || [];
    this.crawlerDefs = data.crawlerDefs || [];
    this.currentLevelID = data.currentLevelID;
    this.currentLevelSeed = data.currentLevelSeed;
    this.currentDifficulty = data.currentDifficulty;
    this.bestScore = data.bestScore != null ? data.bestScore : Infinity;

    this.lastCheckpointIndex = -1;
    this.lives = LIVES_START;
    this.lavaY = WORLD_H - 20;
    this.timerStarted = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.gameWon = false;
    this.isDyingInLava = false;
    this.lavaDeathTimer = 0;
    this.lavaBounceTimer = 0;
    this.lavaBounceItemCollected = false;
    this.fireTotemCollected = false;
    this.fireBreathsLeft = 0;
    this.breathActiveTime = 0;
    this.dotsCollected = this.dotDefs.map(function () { return false; });
    this.dotsCollectedCount = 0;
    this.standingPlatformIndex = -1;
    this.cameraX = 0;

    this.physics.world.setBounds(0, 0, LEVEL_LENGTH, WORLD_H);
    this.physics.world.gravity.y = gravity;

    // Platforms (static) - use rectangles; bent is visual only, collision is AABB
    this.platformGroup = this.physics.add.staticGroup();
    this.platformSprites = [];
    for (var i = 0; i < this.platformsData.length; i++) {
      var p = this.platformsData[i];
      var rect = this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0x8b5cf6);
      this.physics.add.existing(rect, true);
      this.platformGroup.add(rect);
      rect.setData("platformIndex", i);
      rect.setData("platformData", p);
      this.platformSprites.push(rect);
    }

    // Lava zone (invisible overlap)
    this.lavaZone = this.add.rectangle(LEVEL_LENGTH / 2, WORLD_H - 10, LEVEL_LENGTH, 40, 0xff4b3e, 0);
    this.physics.add.existing(this.lavaZone, true);
    this.lavaZone.body.updateFromGameObject = function () {};

    // Goal
    this.goalZone = this.add.rectangle(
      this.goal.x + this.goal.w / 2,
      this.goal.y + this.goal.h / 2,
      this.goal.w,
      this.goal.h,
      0xffd93d
    );
    this.physics.add.existing(this.goalZone, true);
    this.goalZone.body.updateFromGameObject = function () {};

    // Player - fixed hitbox: body size 30x26, centered; flip only sprite for facing
    this.player = this.add.rectangle(0, 0, DRAGON_W, DRAGON_H, 0x4a9b4a);
    this.physics.add.existing(this.player, false);
    this.player.body.setSize(DRAGON_W, DRAGON_H);
    this.player.body.setOffset(0, 0);
    this.player.body.setCollideWorldBounds(true);
    this.player.setDepth(20);
    this.player.facing = 1;
    this.player.onGround = false;
    this.player.jumpsLeft = 2;
    this.player.boostAvailable = true;
    this.player.boostFramesLeft = 0;
    this.player.timeInAir = 0;
    var startPlat = this.platformsData[0];
    this.player.x = startPlat.x + startPlat.w / 2;
    this.player.y = startPlat.y - DRAGON_H / 2 - 8;
    this.player.body.setVelocity(0, 0);

    // Slimes (dynamic bodies, no gravity - we animate in update)
    this.slimes = [];
    var slimeW = 22, slimeH = 18;
    for (var si = 0; si < this.slimeDefs.length; si++) {
      var def = this.slimeDefs[si];
      var plat = this.platformsData[def.platformIndex];
      if (!plat) continue;
      var baseX = plat.x + def.offset * plat.w - slimeW / 2;
      var baseY = plat.y - slimeH;
      var delay = (typeof def.delay === "number" && def.delay > 0) ? def.delay : 60 + Math.random() * 120;
      var slime = this.add.rectangle(baseX + slimeW / 2, baseY + slimeH / 2, slimeW, slimeH, 0x4ade80);
      this.physics.add.existing(slime, false);
      slime.body.setAllowGravity(false);
      slime.body.setVelocity(0, 0);
      slime.setData("platformIndex", def.platformIndex);
      slime.setData("offset", def.offset);
      slime.setData("baseX", baseX + slimeW / 2);
      slime.setData("baseY", baseY + slimeH / 2);
      slime.setData("state", "waiting");
      slime.setData("timer", delay / REFERENCE_FPS);
      slime.setData("vy", 0);
      slime.setData("dead", false);
      this.slimes.push(slime);
    }

    // Bats
    this.bats = [];
    for (var bi = 0; bi < this.batDefs.length; bi++) {
      var bdef = this.batDefs[bi];
      var bat = this.add.rectangle(bdef.x + BAT_W / 2, bdef.y + BAT_H / 2, BAT_W, BAT_H, 0x1e1e28);
      this.physics.add.existing(bat, false);
      bat.body.setAllowGravity(false);
      bat.body.setVelocity(0, 0);
      bat.setData("rng", makeRng(bdef.rngSeed != null ? bdef.rngSeed : bi));
      this.bats.push(bat);
    }

    // Crawlers
    this.crawlers = [];
    for (var ci = 0; ci < this.crawlerDefs.length; ci++) {
      var cdef = this.crawlerDefs[ci];
      var cplat = this.platformsData[cdef.platformIndex];
      if (!cplat) continue;
      var pos = crawlerPerimeterPosition(cplat, cdef.offset);
      var crawler = this.add.rectangle(pos.cx, pos.cy, CRAWLER_W, CRAWLER_H, 0x3b82f6);
      this.physics.add.existing(crawler, false);
      crawler.body.setAllowGravity(false);
      crawler.setData("platformIndex", cdef.platformIndex);
      crawler.setData("offset", cdef.offset);
      crawler.setData("dead", false);
      this.crawlers.push(crawler);
    }

    // Stalactites (overlap zones - use rectangles)
    this.stalactites = [];
    for (var sti = 0; sti < this.stalactiteDefs.length; sti++) {
      var st = this.stalactiteDefs[sti];
      var sx = st.x;
      var sy = st.y;
      var sw = st.w || 24;
      var sh = st.length || 40;
      var rect = this.add.rectangle(sx, sy + sh / 2, sw, sh, 0x3f2b63, 0);
      this.physics.add.existing(rect, true);
      rect.body.updateFromGameObject = function () {};
      this.stalactites.push(rect);
    }

    // Dots
    this.dotSprites = [];
    for (var di = 0; di < this.dotDefs.length; di++) {
      var d = this.dotDefs[di];
      var dot = this.add.rectangle(d.x, d.y, DOT_R * 2, DOT_R * 2, 0xe879f9);
      this.physics.add.existing(dot, true);
      dot.body.updateFromGameObject = function () {};
      dot.setData("index", di);
      dot.setData("collected", false);
      this.dotSprites.push(dot);
    }

    // Checkpoints (invisible overlap)
    this.checkpointZones = [];
    for (var cpi = 0; cpi < this.checkpointDefs.length; cpi++) {
      var cp = this.checkpointDefs[cpi];
      var cpplat = this.platformsData[cp.platformIndex];
      if (!cpplat) continue;
      var poleCenterX = cpplat.x + cpplat.w * cp.offset;
      var poleTop = cpplat.y - POLE_H;
      var zone = this.add.rectangle(poleCenterX, poleTop + POLE_H / 2, POLE_W, POLE_H, 0x4a5568, 0);
      this.physics.add.existing(zone, true);
      zone.body.updateFromGameObject = function () {};
      zone.setData("index", cpi);
      this.checkpointZones.push(zone);
    }

    // Items
    this.itemZones = [];
    for (var ii = 0; ii < this.itemDefs.length; ii++) {
      var it = this.itemDefs[ii];
      var iz = this.add.rectangle(it.x + it.w / 2, it.y + it.h / 2, it.w, it.h, it.type === "fireTotem" ? 0xffb84d : 0xffb84d, 0.5);
      this.physics.add.existing(iz, true);
      iz.body.updateFromGameObject = function () {};
      iz.setData("item", it);
      iz.setData("collected", false);
      this.itemZones.push(iz);
    }

    // Fire breath hitbox (created when breathing)
    this.breathZone = null;

    this.physics.add.collider(this.player, this.platformGroup, null, null, this);
    this.physics.add.overlap(this.player, this.lavaZone, this.onOverlapLava, null, this);
    this.physics.add.overlap(this.player, this.goalZone, this.onOverlapGoal, null, this);
    this.physics.add.overlap(this.player, this.dotSprites, this.onOverlapDot, null, this);
    this.physics.add.overlap(this.player, this.checkpointZones, this.onOverlapCheckpoint, null, this);
    this.physics.add.overlap(this.player, this.itemZones, this.onOverlapItem, null, this);
    this.physics.add.overlap(this.player, this.slimes, this.onOverlapSlime, null, this);
    this.physics.add.overlap(this.player, this.bats, this.onOverlapBat, null, this);
    this.physics.add.overlap(this.player, this.crawlers, this.onOverlapCrawler, null, this);
    this.physics.add.overlap(this.player, this.stalactites, this.onOverlapStalactite, null, this);

    this.cameras.main.setBounds(0, 0, LEVEL_LENGTH, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(0, 0);

    this.hudText = this.add.text(16, 14, "", { fontSize: "14px", color: "#fff", backgroundColor: "#00000088" }).setScrollFactor(0).setDepth(100);
    if (this.hudText.setPadding) this.hudText.setPadding(8, 4);
  };

  GameScene.prototype.updateHUD = function () {
    var bestStr = (this.bestScore !== Infinity && isFinite(this.bestScore)) ? this.bestScore.toFixed(2) : "--";
    var livesStr = "\u2665".repeat(this.lives) + "\u2661".repeat(LIVES_START - this.lives);
    var diffStr = this.currentDifficulty != null ? " (Diff " + Math.max(1, Math.min(30, Math.floor(this.currentDifficulty))) + ")" : "";
    var levelStr = (this.currentLevelSeed != null && this.currentLevelSeed > 0) ? String(this.currentLevelSeed) : (this.currentLevelID || "--");
    var flameStr = this.fireBreathsLeft > 0 ? "\nFlame (G)" : "";
    this.hudText.setText(
      "Time: " + this.currentTime.toFixed(2) + "  Best: " + bestStr + "\nDots: " + this.dotsCollectedCount + "/" + NUM_DOTS + "  Lives: " + livesStr + "\nLevel: " + levelStr + diffStr + flameStr
    );
  };

  GameScene.prototype.onOverlapLava = function (player, zone) {
    if (this.gameWon || this.isDyingInLava) return;
    if (this.lavaBounceTimer > 0) {
      this.player.body.setVelocityY(LAVA_BOUNCE_VY);
      this.player.y = this.lavaY - DRAGON_H - 2;
      this.player.onGround = false;
      this.player.jumpsLeft = 1;
      this.player.boostAvailable = false;
      return;
    }
    this.isDyingInLava = true;
    this.lavaDeathTimer = LAVA_DEATH_DURATION;
  };

  GameScene.prototype.onOverlapGoal = function (player, zone) {
    if (this.gameWon) return;
    this.gameWon = true;
    this.player.body.setVelocity(0, 0);
    var levelState = {
      H: this.WORLD_H,
      currentDifficulty: this.currentDifficulty,
      slimeDefs: this.slimeDefs,
      ceilingPoints: this.ceilingPoints,
      stalactiteDefs: this.stalactiteDefs,
      batDefs: this.batDefs,
      itemDefs: this.itemDefs,
      dotDefs: this.dotDefs,
      checkpointDefs: this.checkpointDefs,
      crawlerDefs: this.crawlerDefs,
      currentLevelSeed: this.currentLevelSeed
    };
    var data = loadAllLevels(this.WORLD_H);
    var existing = data.levels.find(function (l) { return l.id === this.currentLevelID; }.bind(this));
    if (!existing) {
      var name = window.prompt("Name this level:");
      if (name) {
        saveCompletedLevel(this.currentLevelID, name, this.platformsData, this.goal, this.currentTime, this.dotsCollectedCount, levelState, window.__dragonPopulateLevelDropdown);
        window.alert("Level saved!");
      }
    } else {
      saveCompletedLevel(existing.id, existing.name, this.platformsData, this.goal, this.currentTime, this.dotsCollectedCount, levelState, window.__dragonPopulateLevelDropdown);
    }
    if (typeof this.bestScore !== "number" || !isFinite(this.bestScore) || this.currentTime < this.bestScore) {
      this.bestScore = this.currentTime;
    }
    if (typeof window.__dragonPopulateLevelDropdown === "function") window.__dragonPopulateLevelDropdown();
    this.showWinOverlay();
  };

  GameScene.prototype.onOverlapDot = function (player, dot) {
    if (dot.getData("collected")) return;
    var idx = dot.getData("index");
    this.dotsCollected[idx] = true;
    this.dotsCollectedCount++;
    dot.setData("collected", true);
    dot.setVisible(false);
    dot.body.checkCollision.none = true;
  };

  GameScene.prototype.onOverlapCheckpoint = function (player, zone) {
    var idx = zone.getData("index");
    if (idx > this.lastCheckpointIndex) this.lastCheckpointIndex = idx;
  };

  GameScene.prototype.onOverlapItem = function (player, zone) {
    if (zone.getData("collected")) return;
    var it = zone.getData("item");
    if (it.type === "lavaBounce") {
      this.lavaBounceItemCollected = true;
      this.lavaBounceTimer = 5;
    } else if (it.type === "fireTotem") {
      this.fireTotemCollected = true;
      this.fireBreathsLeft = 1;
    }
    zone.setData("collected", true);
    zone.setVisible(false);
    zone.body.checkCollision.none = true;
  };

  GameScene.prototype.onOverlapSlime = function (player, slime) {
    if (slime.getData("dead")) return;
    if (this.fireBreathsLeft > 0) {
      slime.setData("dead", true);
      slime.setVisible(false);
      slime.body.checkCollision.none = true;
      this.fireBreathsLeft = 0;
      this.fireTotemCollected = false;
      return;
    }
    this.applyDeath();
  };

  GameScene.prototype.onOverlapBat = function (player, bat) {
    this.applyDeath();
  };

  GameScene.prototype.onOverlapCrawler = function (player, crawler) {
    if (crawler.getData("dead")) return;
    if (this.fireBreathsLeft > 0) {
      crawler.setData("dead", true);
      crawler.setVisible(false);
      crawler.body.checkCollision.none = true;
      this.fireBreathsLeft = 0;
      this.fireTotemCollected = false;
      return;
    }
    this.applyDeath();
  };

  GameScene.prototype.onOverlapStalactite = function (player, st) {
    this.applyDeath();
  };

  GameScene.prototype.applyDeath = function () {
    this.lives--;
    if (this.lives <= 0) {
      this.lastCheckpointIndex = -1;
      this.lives = LIVES_START;
    }
    this.resetPlayer();
  };

  GameScene.prototype.resetPlayer = function () {
    // Restore platforms from base (drop platforms reset)
    this.platformsData.length = 0;
    for (var i = 0; i < this.basePlatformsData.length; i++) {
      this.platformsData.push(JSON.parse(JSON.stringify(this.basePlatformsData[i])));
    }
    // Rebuild static platform bodies from current platform data
    this.platformGroup.clear(true, true);
    this.platformSprites = [];
    for (var j = 0; j < this.platformsData.length; j++) {
      var p = this.platformsData[j];
      var rect = this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0x8b5cf6);
      this.physics.add.existing(rect, true);
      this.platformGroup.add(rect);
      rect.setData("platformIndex", j);
      rect.setData("platformData", p);
      this.platformSprites.push(rect);
    }
    var startX, startY;
    if (this.lastCheckpointIndex >= 0 && this.checkpointDefs[this.lastCheckpointIndex]) {
      var cp = this.checkpointDefs[this.lastCheckpointIndex];
      var cpplat = this.platformsData[cp.platformIndex];
      if (cpplat) {
        startX = cpplat.x + cpplat.w * cp.offset;
        startY = cpplat.y - DRAGON_H / 2 - 8;
      } else {
        var sp = this.platformsData[0];
        startX = sp.x + sp.w / 2;
        startY = sp.y - DRAGON_H / 2 - 8;
      }
    } else {
      var startPlat = this.platformsData[0];
      startX = startPlat.x + startPlat.w / 2;
      startY = startPlat.y - DRAGON_H / 2 - 8;
    }
    this.player.x = startX;
    this.player.y = startY;
    this.player.body.setVelocity(0, 0);
    this.player.facing = 1;
    this.player.onGround = true;
    this.player.jumpsLeft = 2;
    this.player.boostAvailable = true;
    this.player.boostFramesLeft = 0;
    this.player.timeInAir = 0;

    // Reset slimes
    var slimeW = 22, slimeH = 18;
    for (var si = 0; si < this.slimes.length; si++) {
      var slime = this.slimes[si];
      var def = this.slimeDefs[si];
      var plat = this.platformsData[def.platformIndex];
      if (!plat) continue;
      var baseX = plat.x + def.offset * plat.w - slimeW / 2;
      var baseY = plat.y - slimeH;
      slime.x = baseX + slimeW / 2;
      slime.y = baseY + slimeH / 2;
      slime.body.setVelocity(0, 0);
      slime.setData("baseX", baseX + slimeW / 2);
      slime.setData("baseY", baseY + slimeH / 2);
      slime.setData("state", "waiting");
      slime.setData("timer", (60 + Math.random() * 120) / REFERENCE_FPS);
      slime.setData("vy", 0);
      slime.setData("dead", false);
      slime.setVisible(true);
      slime.body.checkCollision.none = false;
    }
    for (var bi = 0; bi < this.bats.length; bi++) {
      var bat = this.bats[bi];
      var bdef = this.batDefs[bi];
      bat.x = bdef.x + BAT_W / 2;
      bat.y = bdef.y + BAT_H / 2;
      bat.body.setVelocity(0, 0);
    }
    for (var ci = 0; ci < this.crawlers.length; ci++) {
      var crawler = this.crawlers[ci];
      var cdef = this.crawlerDefs[ci];
      var cplat = this.platformsData[cdef.platformIndex];
      if (!cplat) continue;
      var pos = crawlerPerimeterPosition(cplat, cdef.offset);
      crawler.x = pos.cx;
      crawler.y = pos.cy;
      crawler.setData("offset", cdef.offset);
      crawler.setData("dead", false);
      crawler.setVisible(true);
      crawler.body.checkCollision.none = false;
    }

    this.lavaBounceItemCollected = false;
    this.lavaBounceTimer = 0;
    this.fireBreathsLeft = 0;
    this.fireTotemCollected = false;
    this.breathActiveTime = 0;
    if (this.lastCheckpointIndex < 0) {
      this.dotsCollected = this.dotDefs.map(function () { return false; });
      this.dotsCollectedCount = 0;
      for (var di = 0; di < this.dotSprites.length; di++) {
        this.dotSprites[di].setVisible(true);
        this.dotSprites[di].setData("collected", false);
        this.dotSprites[di].body.checkCollision.none = false;
      }
      for (var ii = 0; ii < this.itemZones.length; ii++) {
        this.itemZones[ii].setVisible(true);
        this.itemZones[ii].setData("collected", false);
        this.itemZones[ii].body.checkCollision.none = false;
      }
    }
    this.timerStarted = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.gameWon = false;
    this.isDyingInLava = false;
    this.lavaDeathTimer = 0;
  };

  GameScene.prototype.showWinOverlay = function () {
    var el = document.getElementById("winOverlay");
    if (!el) return;
    el.style.display = "flex";
    var timeEl = document.getElementById("winTime");
    var dotsEl = document.getElementById("winDots");
    var bestEl = document.getElementById("winBest");
    if (timeEl) timeEl.textContent = "Time: " + this.currentTime.toFixed(2) + "s";
    if (dotsEl) dotsEl.textContent = this.dotsCollectedCount + "/" + NUM_DOTS;
    if (bestEl) {
      if (this.bestScore !== Infinity && Math.abs(this.currentTime - this.bestScore) < 0.01) bestEl.textContent = "New best!";
      else if (this.bestScore !== Infinity) bestEl.textContent = "Best: " + this.bestScore.toFixed(2) + "s";
      else bestEl.textContent = "Best: --";
    }
    var nextBtn = document.getElementById("winNextLevelBtn");
    if (nextBtn) {
      var data = loadAllLevels(this.WORLD_H);
      if (data.levels && data.levels.length > 0) {
        var idx = data.levels.findIndex(function (l) { return l.id === this.currentLevelID; }.bind(this));
        nextBtn.style.display = "";
        nextBtn.textContent = (idx >= 0 && idx < data.levels.length - 1) ? "Next level →" : "First level →";
      }
    }
  };

  GameScene.prototype.update = function (time, delta) {
    var dt = delta / 1000;
    if (dt > 0.05) dt = 0.05;

    if (this.gameWon) return;

    if (this.lavaBounceTimer > 0) {
      this.lavaBounceTimer -= dt;
      if (this.lavaBounceTimer < 0) this.lavaBounceTimer = 0;
    }

    if (this.isDyingInLava) {
      this.lavaDeathTimer -= dt;
      this.player.y += 36 * dt;
      this.player.body.setVelocity(this.player.body.velocity.x * 0.9, 0);
      if (this.lavaDeathTimer <= 0) this.applyDeath();
      return;
    }

    var keys = window.__dragonKeys;
    if (!this.timerStarted && (keys.left || keys.right || keys.jump || keys.boost || keys.breath)) {
      this.timerStarted = true;
      this.startTime = time / 1000;
    }
    if (this.timerStarted) this.currentTime = (time / 1000) - this.startTime;

    // Player movement - fixed hitbox: we only change velocity and sprite flip
    this.player.body.setVelocity(0, this.player.body.velocity.y);
    if (keys.left) {
      this.player.body.setVelocityX(-moveSpeed);
      this.player.facing = -1;
    }
    if (keys.right) {
      this.player.body.setVelocityX(moveSpeed);
      this.player.facing = 1;
    }

    var onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) this.player.timeInAir = 0;
    else this.player.timeInAir += dt;

    if (keys.jump && onGround) {
      this.player.body.setVelocityY(-jumpStrength);
      this.player.jumpsLeft = 1;
      window.__dragonJumpKeyReleased = false;
    } else if (keys.jump && !onGround && this.player.jumpsLeft > 0 && window.__dragonJumpKeyReleased) {
      this.player.body.setVelocityY(-jumpStrength);
      this.player.jumpsLeft--;
      window.__dragonJumpKeyReleased = false;
    }

    if (keys.boost && !onGround && this.player.boostAvailable && this.player.timeInAir >= BOOST_AIR_DELAY_SEC) {
      this.player.boostAvailable = false;
      this.player.boostFramesLeft = BOOST_DURATION_SEC;
    }
    if (this.player.boostFramesLeft > 0) {
      this.player.body.setVelocityX(this.player.body.velocity.x + this.player.facing * BOOST_POWER_H * dt);
      var vy = this.player.body.velocity.y - BOOST_POWER_V * dt;
      if (vy < maxUpwardVy) vy = maxUpwardVy;
      this.player.body.setVelocityY(vy);
      this.player.boostFramesLeft -= dt;
    }

    if (keys.breath && !window.__dragonBreathKeyConsumed && this.fireBreathsLeft > 0 && this.breathActiveTime <= 0) {
      window.__dragonBreathKeyConsumed = true;
      this.breathActiveTime = 10 / REFERENCE_FPS;
    }

    // Fire breath overlap vs slimes/crawlers
    if (this.breathActiveTime > 0) {
      var breathX = this.player.x + (this.player.facing > 0 ? 1 : -1) * (DRAGON_W / 2 + DRAGON_MOUTH_OVERHANG + BREATH_LEN / 2);
      var breathW = BREATH_LEN;
      var breathY = this.player.y;
      var breathH = DRAGON_H - 8;
      for (var si = 0; si < this.slimes.length; si++) {
        var s = this.slimes[si];
        if (s.getData("dead")) continue;
        if (breathX - breathW / 2 < s.x + 11 && breathX + breathW / 2 > s.x - 11 &&
            breathY < s.y + 9 && breathY + breathH > s.y - 9) {
          s.setData("dead", true);
          s.setVisible(false);
          s.body.checkCollision.none = true;
        }
      }
      for (var cj = 0; cj < this.crawlers.length; cj++) {
        var c = this.crawlers[cj];
        if (c.getData("dead")) continue;
        if (breathX - breathW / 2 < c.x + CRAWLER_W / 2 && breathX + breathW / 2 > c.x - CRAWLER_W / 2 &&
            breathY < c.y + CRAWLER_H / 2 && breathY + breathH > c.y - CRAWLER_H / 2) {
          c.setData("dead", true);
          c.setVisible(false);
          c.body.checkCollision.none = true;
        }
      }
      this.breathActiveTime -= dt;
    }

    // Slimes update
    for (var si = 0; si < this.slimes.length; si++) {
      var slime = this.slimes[si];
      if (slime.getData("dead")) continue;
      var def = this.slimeDefs[si];
      var plat = this.platformsData[def.platformIndex];
      if (!plat) continue;
      var baseX = slime.getData("baseX");
      var baseY = slime.getData("baseY");
      var state = slime.getData("state");
      if (state === "waiting") {
        slime.x = baseX;
        slime.y = baseY;
        var timer = slime.getData("timer") - dt;
        slime.setData("timer", timer);
        if (timer <= 0) {
          slime.setData("state", "jumping");
          slime.setData("vy", -SLIME_JUMP_STRENGTH);
        }
      } else {
        slime.x = baseX;
        var vy = slime.getData("vy") + gravity * dt;
        slime.setData("vy", vy);
        slime.y += vy * dt;
        if (slime.y >= baseY) {
          slime.y = baseY;
          slime.setData("vy", 0);
          slime.setData("state", "waiting");
          slime.setData("timer", (60 + Math.random() * 120) / REFERENCE_FPS);
        }
      }
    }

    // Bats update (wander; clamp to world)
    var xMin = 50 + BAT_W / 2, xMax = LEVEL_LENGTH - 50 - BAT_W / 2;
    var yMin = 80 + BAT_H / 2, yMax = WORLD_H - 80 - BAT_H / 2;
    for (var bi = 0; bi < this.bats.length; bi++) {
      var bat = this.bats[bi];
      var rng = bat.getData("rng");
      var vx = bat.body.velocity.x + (rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
      var vy = bat.body.velocity.y + (rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > BAT_MAX_SPEED) {
        vx = (vx / speed) * BAT_MAX_SPEED;
        vy = (vy / speed) * BAT_MAX_SPEED;
      }
      bat.body.setVelocity(vx, vy);
      bat.x = Phaser.Math.Clamp(bat.x, xMin, xMax);
      bat.y = Phaser.Math.Clamp(bat.y, yMin, yMax);
      bat.body.updateFromGameObject();
    }

    // Crawlers update
    for (var ck = 0; ck < this.crawlers.length; ck++) {
      var crawler = this.crawlers[ck];
      if (crawler.getData("dead")) continue;
      var cplat = this.platformsData[crawler.getData("platformIndex")];
      if (!cplat) continue;
      var offset = crawler.getData("offset") + CRAWLER_PERIMETER_SPEED * dt;
      if (offset >= 1) offset -= 1;
      crawler.setData("offset", offset);
      var pos = crawlerPerimeterPosition(cplat, offset);
      crawler.x = pos.cx;
      crawler.y = pos.cy;
    }

    // Drop platforms
    for (var pi = 0; pi < this.platformsData.length; pi++) {
      var p = this.platformsData[pi];
      if (!p || !p.drop) continue;
      if (p.dropTimer == null) {
        p.dropTimer = p.drop.delay / REFERENCE_FPS;
        p.dropping = false;
        p.dropActive = false;
      }
      if (this.standingPlatformIndex === pi && !p.dropping) {
        p.dropActive = true;
        if (p.dropTimer > 0) p.dropTimer -= dt;
        if (p.dropTimer <= 0) p.dropping = true;
      }
      if (p.dropping) {
        p.y += p.drop.speed * REFERENCE_FPS * dt;
        var sprite = this.platformSprites[pi];
        if (sprite) {
          sprite.y = p.y + p.h / 2;
          if (sprite.body) sprite.body.updateFromGameObject();
        }
      }
    }

    // Track which platform we're standing on (for drop platforms)
    this.standingPlatformIndex = -1;
    if (onGround) {
      for (var pk = 0; pk < this.platformsData.length; pk++) {
        var plat = this.platformsData[pk];
        if (this.player.x + DRAGON_W / 2 >= plat.x && this.player.x - DRAGON_W / 2 <= plat.x + plat.w &&
            this.player.y + DRAGON_H / 2 >= plat.y - 2 && this.player.y + DRAGON_H / 2 <= plat.y + plat.h + 2) {
          this.standingPlatformIndex = pk;
          break;
        }
      }
    }

    if (onGround) {
      this.player.onGround = true;
      this.player.jumpsLeft = 2;
      this.player.boostAvailable = true;
    } else {
      this.player.onGround = false;
    }

    this.updateHUD();
  };

  // --- UI: populate dropdown, hash, buttons
  function populateLevelDropdown() {
    var select = document.getElementById("levelSelect");
    if (!select) return;
    var data = loadAllLevels(WORLD_H);
    select.innerHTML = "";
    var optNew = document.createElement("option");
    optNew.value = "new";
    optNew.textContent = "New Random Level";
    select.appendChild(optNew);
    data.levels.forEach(function (lvl) {
      var opt = document.createElement("option");
      opt.value = lvl.id;
      var best = (typeof lvl.bestScore === "number" && isFinite(lvl.bestScore)) ? lvl.bestScore.toFixed(2) + "s" : "--";
      var bestDots = (typeof lvl.bestDots === "number" && lvl.bestDots > 0) ? lvl.bestDots + "/" + NUM_DOTS : "--";
      opt.textContent = lvl.name + " (Best: " + best + ", Dots: " + bestDots + ")";
      select.appendChild(opt);
    });
  }

  function loadLevelFromHash() {
    var hash = (location.hash || "").slice(1).trim();
    if (!hash) return false;
    var parts = hash.split("/");
    var hashSeed = parseInt(parts[0], 10);
    var hashDifficulty = parts.length > 1 ? parseInt(parts[1], 10) : 15;
    if (isNaN(hashSeed) || hashSeed <= 0) return false;
    var difficulty = (!isNaN(hashDifficulty) && hashDifficulty >= 1 && hashDifficulty <= 30) ? hashDifficulty : 15;
    window.__dragonLevelData = buildLevelDataForNewSeed(hashSeed, difficulty);
    return true;
  }

  function startOrRestartGame() {
    if (window.__dragonGame && window.__dragonGame.scene && window.__dragonGame.scene.scenes) {
      var scene = window.__dragonGame.scene.getScene("Game");
      if (scene) scene.scene.restart();
    }
  }

  // --- Init: bind input, populate dropdown, set initial level, create Phaser game
  function init() {
    populateLevelDropdown();
    window.__dragonPopulateLevelDropdown = populateLevelDropdown;

    if (!loadLevelFromHash()) {
      var select = document.getElementById("levelSelect");
      var value = select && select.value ? select.value : "new";
      if (value === "new") {
        window.__dragonLevelData = buildLevelDataForRandom();
      } else {
        var data = loadAllLevels(WORLD_H);
        var level = data.levels.find(function (l) { return l.id === value; });
        if (level) window.__dragonLevelData = buildLevelDataFromStored(level);
        else window.__dragonLevelData = buildLevelDataForRandom();
      }
    }

    // Keyboard
    window.addEventListener("keydown", function (e) {
      var keys = window.__dragonKeys;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") keys.jump = true;
      if (e.code === "KeyF") keys.boost = true;
      if (e.code === "KeyG") keys.breath = true;
    });
    window.addEventListener("keyup", function (e) {
      var keys = window.__dragonKeys;
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        keys.jump = false;
        window.__dragonJumpKeyReleased = true;
      }
      if (e.code === "KeyF") keys.boost = false;
      if (e.code === "KeyG") {
        keys.breath = false;
        window.__dragonBreathKeyConsumed = false;
      }
    });

    // On-screen buttons
    function bindBtn(id, keyName) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("pointerdown", function (e) { e.preventDefault(); window.__dragonKeys[keyName] = true; });
      btn.addEventListener("pointerup", function (e) { e.preventDefault(); window.__dragonKeys[keyName] = false; });
      btn.addEventListener("pointerleave", function () { window.__dragonKeys[keyName] = false; });
      btn.addEventListener("pointercancel", function () { window.__dragonKeys[keyName] = false; });
    }
    bindBtn("btnLeft", "left");
    bindBtn("btnRight", "right");
    bindBtn("btnJump", "jump");
    bindBtn("btnBoost", "boost");
    bindBtn("btnBreath", "breath");
    document.getElementById("btnJump") && document.getElementById("btnJump").addEventListener("pointerup", function () { window.__dragonJumpKeyReleased = true; });
    document.getElementById("btnJump") && document.getElementById("btnJump").addEventListener("pointerleave", function () { window.__dragonJumpKeyReleased = true; });
    document.getElementById("btnBreath") && document.getElementById("btnBreath").addEventListener("pointerup", function () { window.__dragonBreathKeyConsumed = false; });
    document.getElementById("btnBreath") && document.getElementById("btnBreath").addEventListener("pointerleave", function () { window.__dragonBreathKeyConsumed = false; });

    // Level select change
    document.getElementById("levelSelect").addEventListener("change", function (e) {
      var value = e.target.value;
      var data = loadAllLevels(WORLD_H);
      if (value === "new") {
        window.__dragonLevelData = buildLevelDataForRandom();
      } else {
        var level = data.levels.find(function (l) { return l.id === value; });
        if (level) window.__dragonLevelData = buildLevelDataFromStored(level);
      }
      startOrRestartGame();
    });

    document.getElementById("newLevelBtn").addEventListener("click", function () {
      window.__dragonLevelData = buildLevelDataForRandom();
      startOrRestartGame();
    });

    document.getElementById("shareBtn").addEventListener("click", function () {
      var data = window.__dragonLevelData;
      var seed = data && data.currentLevelSeed;
      if (seed == null || seed <= 0) {
        window.alert("This level cannot be shared by link.");
        return;
      }
      var difficulty = (data && data.currentDifficulty != null) ? Math.max(1, Math.min(30, Math.floor(data.currentDifficulty))) : null;
      var url = location.origin + location.pathname + "#" + seed + (difficulty != null ? "/" + difficulty : "");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          var btn = document.getElementById("shareBtn");
          var orig = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function () { btn.textContent = orig; }, 1500);
        }).catch(function () {
          window.prompt("Copy this link:", url);
        });
      } else {
        window.prompt("Copy this link:", url);
      }
    });

    document.getElementById("winNextLevelBtn").addEventListener("click", function () {
      var data = loadAllLevels(WORLD_H);
      if (!data.levels.length) return;
      var scene = window.__dragonGame && window.__dragonGame.scene.getScene("Game");
      var currentID = scene ? scene.currentLevelID : null;
      var idx = data.levels.findIndex(function (l) { return l.id === currentID; });
      var nextLevel = (idx >= 0 && idx < data.levels.length - 1) ? data.levels[idx + 1] : data.levels[0];
      window.__dragonLevelData = buildLevelDataFromStored(nextLevel);
      document.getElementById("winOverlay").style.display = "none";
      startOrRestartGame();
    });

    document.getElementById("winReplayBtn").addEventListener("click", function () {
      if (window.__dragonGame && window.__dragonGame.scene.getScene("Game")) {
        window.__dragonGame.scene.getScene("Game").lastCheckpointIndex = -1;
        window.__dragonGame.scene.getScene("Game").lives = LIVES_START;
      }
      document.getElementById("winOverlay").style.display = "none";
      startOrRestartGame();
    });

    window.addEventListener("hashchange", function () {
      if (loadLevelFromHash()) startOrRestartGame();
    });

    var config = {
      type: Phaser.AUTO,
      parent: "phaser-game",
      width: 640,
      height: 360,
      backgroundColor: "#1a1a2e",
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: gravity },
          debug: false
        }
      },
      scene: GameScene
    };
    window.__dragonGame = new Phaser.Game(config);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
