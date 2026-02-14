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
  var CACTUS_AVOID_BAND = 0.2;  // dots must not touch cacti (platform-ratio band each side of cactus center)
  var STALACTITE_AVOID_BAND = 28;  // pixels: no checkpoint/dot directly under a stalactite
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
  var DOUBLE_JUMP_PLAT_W = 24;
  var DOUBLE_JUMP_PLAT_H = 8;
  var DOUBLE_JUMP_PLAT_FADE_DURATION = 150;
  var DOUBLE_JUMP_PLAT_VISIBLE_MS = 220;
  var GROUND_EDGE_TOLERANCE = 12;   // pixels past platform edge still count as "on platform" for jump
  var GROUND_TOP_TOLERANCE = 10;    // feet within this many px above platform top = on ground
  var BREATH_LEN = 50;
  var BOOST_AIR_DELAY_SEC = 6 / REFERENCE_FPS;
  // Boost = straight forward only, strong horizontal push (no vertical)
  var BOOST_DURATION_SEC = 14 / REFERENCE_FPS;
  var BOOST_POWER_H = (72 / 12) * REFERENCE_FPS * REFERENCE_FPS;
  var maxUpwardVy = -jumpStrength - 0.5 * REFERENCE_FPS;
  // Stronger lava bounce (approx a jump or higher)
  var LAVA_BOUNCE_VY = -jumpStrength * 1.1;
  var LAVA_DEATH_DURATION = 35 / REFERENCE_FPS;
  // Max distance (px) at which creature/platform sounds are audible (~just off screen)
  var HEARING_MAX_DISTANCE = 420;

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
  function generateCeilingAndStalactites(difficulty, seed, platforms, worldHeight, worldMinY) {
    worldHeight = worldHeight || WORLD_H;
    worldMinY = worldMinY != null ? worldMinY : 0;
    var rng = makeRng(seed);
    var pts = [];
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var t = (dClamped - 1) / 29;
    var step = 120;
    var x = 0;
    var baseY = 30;
    var amp = 8 + t * 22;
    var ceilingMinY = worldMinY + 20;
    while (x <= LEVEL_LENGTH) {
      var minPlatY = worldHeight;
      for (var pi = 0; pi < (platforms || []).length; pi++) {
        var plat = platforms[pi];
        if (!plat) continue;
        if (x >= plat.x && x <= plat.x + (plat.w || 0)) {
          if (plat.y < minPlatY) minPlatY = plat.y;
        }
      }
      var roofY = minPlatY < worldHeight ? minPlatY - 60 : baseY;
      var y = roofY + rngRange(rng, -amp, amp);
      y = Math.max(ceilingMinY, Math.min(roofY + 40, y));
      pts.push({ x: x, y: y });
      baseY = baseY * 0.5 + y * 0.5;
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
  function generateLavaBounceItem(seed, H, platforms) {
    var rng = makeRng(seed);
    var x, y;
    if (Array.isArray(platforms) && platforms.length > 0) {
      var idx = Math.floor(platforms.length * (0.35 + rng() * 0.35));
      idx = Math.max(0, Math.min(idx, platforms.length - 1));
      var p = platforms[idx];
      x = p.x + (p.w || 0) / 2 + rngRange(rng, -40, 40);
      y = (p.y || 0) - 36 + rngRange(rng, -8, 8);
    } else {
      x = LEVEL_LENGTH / 2 + rngRange(rng, -80, 80);
      y = H - 220 + rngRange(rng, -30, 30);
    }
    return [{ type: "lavaBounce", x: x, y: y, w: 28, h: 28 }];
  }
  function generateFireTotemItem(seed, H, platforms) {
    var rng = makeRng(seed);
    var x, y;
    if (Array.isArray(platforms) && platforms.length > 0) {
      var idx = Math.floor(platforms.length * (0.15 + rng() * 0.35));
      idx = Math.max(0, Math.min(idx, platforms.length - 1));
      var p = platforms[idx];
      x = p.x + (p.w || 0) / 2 + rngRange(rng, -30, 30);
      y = (p.y || 0) - 40 + rngRange(rng, -8, 8);
    } else {
      x = LEVEL_LENGTH / 4 + rngRange(rng, -60, 60);
      y = H - 200 + rngRange(rng, -40, 20);
    }
    return [{ type: "fireTotem", x: x, y: y, w: 24, h: 36 }];
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
  function generateCheckpoints(platforms, slimeDefs, seed, obstacleOpts) {
    obstacleOpts = obstacleOpts || {};
    var slimePlatformIndices = new Set((slimeDefs || []).map(function (s) { return s.platformIndex; }));
    var cactusPlatformIndices = new Set();
    (obstacleOpts.cactusDefs || []).forEach(function (c) { cactusPlatformIndices.add(c.platformIndex); });
    var stalactiteDefs = obstacleOpts.stalactiteDefs || [];
    var excludedByStalactite = new Set();
    for (var si = 0; si < platforms.length; si++) {
      var p = platforms[si];
      if (!p) continue;
      for (var st = 0; st < stalactiteDefs.length; st++) {
        var sx = stalactiteDefs[st].x;
        if (sx >= p.x - STALACTITE_AVOID_BAND && sx <= p.x + (p.w || 0) + STALACTITE_AVOID_BAND)
          excludedByStalactite.add(si);
      }
    }
    var candidates = platforms
      .map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) {
        if (x.i <= 0) return false;
        if (slimePlatformIndices.has(x.i)) return false;
        if (cactusPlatformIndices.has(x.i)) return false;
        if (excludedByStalactite.has(x.i)) return false;
        return true;
      });
    if (candidates.length < 2) {
      candidates = platforms.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.i > 0; });
    }
    if (candidates.length < 2) return [];
    var targetIdx1 = Math.floor(candidates.length * 1 / 3);
    var targetIdx2 = Math.floor(candidates.length * 2 / 3);
    targetIdx1 = Math.min(targetIdx1, candidates.length - 2);
    targetIdx2 = Math.max(targetIdx2, targetIdx1 + 1);
    targetIdx2 = Math.min(targetIdx2, candidates.length - 1);
    var idx1 = candidates[targetIdx1].i;
    var idx2 = candidates[targetIdx2].i;
    if (idx1 === idx2 && candidates.length >= 2) idx2 = candidates[Math.min(targetIdx2 + 1, candidates.length - 1)].i;
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
  function generateDots(platforms, seed, goal, slimeDefs, crawlerDefs, cactusDefs, stalactiteDefs) {
    var dots = [];
    var maxX = (goal && typeof goal.x === "number") ? goal.x - DOT_SAFETY_MARGIN : LEVEL_LENGTH - 50;
    var crawlerPlatforms = new Set((crawlerDefs || []).map(function (c) { return c.platformIndex; }));
    var slimeByPlatform = new Map();
    (slimeDefs || []).forEach(function (s) { slimeByPlatform.set(s.platformIndex, s); });
    var cactusByPlatform = new Map();
    (cactusDefs || []).forEach(function (c) {
      if (!cactusByPlatform.has(c.platformIndex)) cactusByPlatform.set(c.platformIndex, []);
      cactusByPlatform.get(c.platformIndex).push(c);
    });
    var safePlatforms = (platforms || []).map(function (p, i) { return { p: p, i: i }; }).filter(
      function (x) { return x.p && x.p.w > 12 && x.p.x < maxX && !crawlerPlatforms.has(x.i); }
    );
    var segments = [];
    var stDefs = stalactiteDefs || [];
    for (var si = 0; si < safePlatforms.length; si++) {
      var sp = safePlatforms[si];
      var p = sp.p;
      var i = sp.i;
      var left = p.x + 8;
      var right = Math.min(p.x + p.w - 8, maxX - 4);
      var y = p.y - 6;
      if (right <= left) continue;
      var slime = slimeByPlatform.get(i);
      var cacti = cactusByPlatform.get(i) || [];
      var avoidRanges = [];
      if (slime) {
        avoidRanges.push([
          Math.max(left, p.x + p.w * (slime.offset - SLIME_AVOID_BAND)),
          Math.min(right, p.x + p.w * (slime.offset + SLIME_AVOID_BAND))
        ]);
      }
      cacti.forEach(function (c) {
        avoidRanges.push([
          Math.max(left, p.x + p.w * (c.offset - CACTUS_AVOID_BAND)),
          Math.min(right, p.x + p.w * (c.offset + CACTUS_AVOID_BAND))
        ]);
      });
      for (var st = 0; st < stDefs.length; st++) {
        var sx = stDefs[st].x;
        if (sx >= p.x && sx <= p.x + (p.w || 0)) {
          avoidRanges.push([
            Math.max(left, sx - STALACTITE_AVOID_BAND),
            Math.min(right, sx + STALACTITE_AVOID_BAND)
          ]);
        }
      }
      if (avoidRanges.length === 0) {
        segments.push({ left: left, right: right, y: y });
      } else {
        avoidRanges.sort(function (a, b) { return a[0] - b[0]; });
        var merged = [];
        for (var r = 0; r < avoidRanges.length; r++) {
          var ar = avoidRanges[r];
          if (merged.length && ar[0] <= merged[merged.length - 1][1]) {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], ar[1]);
          } else {
            merged.push([ar[0], ar[1]]);
          }
        }
        var segLeft = left;
        for (var m = 0; m < merged.length; m++) {
          if (segLeft < merged[m][0]) segments.push({ left: segLeft, right: merged[m][0], y: y });
          segLeft = Math.max(segLeft, merged[m][1]);
        }
        if (segLeft < right) segments.push({ left: segLeft, right: right, y: y });
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

  function computeWorldHeightFromPlatforms(platforms) {
    if (!Array.isArray(platforms) || !platforms.length) return WORLD_H;
    var maxBottom = 0;
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (!p) continue;
      var bottom = p.y + (p.h || 16);
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return Math.max(maxBottom + 120, WORLD_H);
  }

  // Base play height for start; dynamic world extends well above and below.
  // Y increases downward, so smaller/negative values are higher in the cave.
  var BASE_START_Y = 220;
  // Allow very tall upward shafts (2–3x current height).
  var MAX_UP_Y = -400;     // ceiling: platforms can go far above the start
  // Allow very deep pits.
  var MAX_DOWN_Y = 1400;   // floor: platforms can go far below the start

  function generateDefaultLevelLayout(difficulty, seed, H) {
    var rng = makeRng(seed);
    var platforms = [];
    var start = { x: 40, y: BASE_START_Y, w: 180, h: 16 };
    platforms.push(start);
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var t = (dClamped - 1) / 29;
    var easyMin = 140, easyMax = 220;
    var hardMin = easyMin * 0.5, hardMax = easyMax * 0.5;
    var globalMin = easyMin + (hardMin - easyMin) * t;
    var globalMax = easyMax + (hardMax - easyMax) * t;
    var shortProb = 0.2 + 0.6 * t;
    var shortMin = globalMin * 0.6, shortMax = globalMin;
    var longMin = globalMin, longMax = globalMax * 1.1;
    var bendChance = 0.1 + 0.6 * t;

    var cx = start.x + start.w + 70;
    var cy = BASE_START_Y;
    var segmentCount = 2 + Math.floor(difficulty / 5);
    segmentCount = Math.min(segmentCount, 7);
    var segments = [];
    var lastDir = "right";
    for (var si = 0; si < segmentCount; si++) {
      var dir;
      if (si === 0) {
        dir = "right";
      } else if (lastDir === "right") {
        dir = rng() < 0.5 ? "up" : "down";
      } else {
        dir = "right";
      }
      lastDir = dir;
      var platCount = 3 + Math.floor(4 + difficulty * 0.2);
      if (dir === "right") platCount = Math.floor(platCount * 1.4);
      segments.push({ dir: dir, platCount: platCount });
    }
    if (lastDir !== "right") {
      segments.push({ dir: "right", platCount: Math.floor(4 + difficulty * 0.15) });
    }

    for (var si = 0; si < segments.length; si++) {
      var seg = segments[si];
      var dir = seg.dir;
      var platCount = seg.platCount;
      var gapMin = 90 + difficulty * 4;
      var gapMax = 130 + difficulty * 8;
      var vertStep = 55 + difficulty * 2;
      var vertStepMin = 45;
      // Vertical segments: larger steps for dramatic ceiling/floor change
      if (dir === "up") {
        vertStep = 70 + difficulty * 3;
        vertStepMin = 55;
      } else if (dir === "down") {
        vertStep = 70 + difficulty * 3;
        vertStepMin = 55;
      }

      for (var pi = 0; pi < platCount; pi++) {
        var useShort = rng() < shortProb;
        var w = useShort ? rngRange(rng, shortMin, shortMax) : rngRange(rng, longMin, longMax);
        var platform;

        if (dir === "right") {
          var gap = rngRange(rng, gapMin, gapMax);
          cx += gap;
          if (cx > LEVEL_LENGTH - 260) break;
          var vertAmp = 40 + difficulty * 3;
          var y = cy + rngRange(rng, -vertAmp, vertAmp);
          y = Math.max(MAX_UP_Y, Math.min(MAX_DOWN_Y, y));
          platform = { x: cx, y: y, w: w, h: 16 };
          cy = cy * 0.6 + y * 0.4;
        } else if (dir === "up") {
          if (pi > 0) {
            var step = rngRange(rng, vertStepMin, vertStep);
            cy -= step;
            cy = Math.max(MAX_UP_Y, cy);
          }
          var xWiggle = rngRange(rng, -20, 20);
          cx = Math.max(80, Math.min(LEVEL_LENGTH - 120, cx + xWiggle));
          platform = { x: cx, y: cy, w: w, h: 16 };
        } else {
          if (pi > 0) {
            var stepD = rngRange(rng, vertStepMin, vertStep);
            cy += stepD;
            cy = Math.min(MAX_DOWN_Y, cy);
          }
          var xWiggleD = rngRange(rng, -20, 20);
          cx = Math.max(80, Math.min(LEVEL_LENGTH - 120, cx + xWiggleD));
          platform = { x: cx, y: cy, w: w, h: 16 };
        }

        if (rng() < bendChance) {
          platform.bend = {
            joint: rngRange(rng, 0.25, 0.75),
            bendHeight: (rng() < 0.5 ? -1 : 1) * rngRange(rng, 6, 14)
          };
        }
        platforms.push(platform);
      }
      if (dir !== "right") {
        var horizEase = rngRange(rng, 60, 120);
        cx += horizEase;
      }
    }

    // Compute dynamic world vertical span from platform bounds.
    // minPlatY: highest platform (smallest y), maxPlatY: lowest platform bottom.
    var minPlatY = Infinity;
    var maxPlatY = 0;
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (!p) continue;
      if (p.y < minPlatY) minPlatY = p.y;
      var bottom = p.y + (p.h || 16);
      if (bottom > maxPlatY) maxPlatY = bottom;
    }
    if (!isFinite(minPlatY)) minPlatY = BASE_START_Y;
    var worldHeight = Math.max(maxPlatY + 120, WORLD_H);
    // World vertical bounds:
    // - worldMinY can go above 0 so we get tall upward shafts with headroom
    //   (a margin above the highest platform).
    // - worldMaxY is the bottom of the cave where lava sits.
    var worldMinY = Math.min(0, minPlatY - 200);
    var worldMaxY = worldHeight;

    var dropProbBase = 0.06 + 0.18 * t;
    var maxDroppers = Math.max(1, Math.floor((platforms.length - 2) * (0.08 + 0.2 * t)));
    var dropCount = 0;
    for (var di = 1; di < platforms.length - 1 && dropCount < maxDroppers; di++) {
      var pp = platforms[di];
      if (!pp || pp.y > worldHeight - 120) continue;
      if (rng() > dropProbBase) continue;
      pp.drop = { delay: 30 + rng() * 45, speed: 2.4 + t * 1.6 };
      dropCount++;
    }
    var last = platforms[platforms.length - 1];
    var goalX = Math.min(LEVEL_LENGTH - 120, Math.max(last.x + last.w + 80, cx + 80));
    var goalY = last ? (last.y - 20) : (worldHeight - 120);
    goalY = Math.max(MAX_UP_Y + 40, Math.min(worldHeight - 120, goalY));
    var goal = { x: goalX, y: goalY, w: 50, h: 80 };
    var options = { platforms: platforms, difficulty: dClamped, seed: seed, H: worldHeight, worldMinY: worldMinY, layout: {} };
    var genLayout = runBiomeGenerators(DefaultBiome, options);
    var slimes = genLayout.slimes || [];
    var crawlers = genLayout.crawlers || [];
    var items = generateLavaBounceItem(seed + 888, worldHeight, platforms).concat(generateFireTotemItem(seed + 999, worldHeight, platforms));
    var checkpoints = generateCheckpoints(platforms, slimes, seed + 111, { stalactiteDefs: genLayout.stalactites || [], cactusDefs: [] });
    var dots = generateDots(platforms, seed + 444, goal, slimes, crawlers, undefined, genLayout.stalactites || []);
    return {
      platforms: platforms,
      goal: goal,
      worldHeight: worldHeight,
      worldMinY: worldMinY,
      worldMaxY: worldMaxY,
      ceilingPoints: genLayout.ceilingPoints || [],
      stalactites: genLayout.stalactites || [],
      bats: genLayout.bats || [],
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

  // --- Biomes: abstract level generation and entities per biome
  var BIOME_STORAGE_KEY = "dragonBiome";

  function getSelectedBiomeId() {
    try {
      var v = localStorage.getItem(BIOME_STORAGE_KEY);
      if (v === "desert" || v === "default") return v;
    } catch (e) {}
    return "default";
  }

  function setSelectedBiomeId(id) {
    try {
      if (id === "desert" || id === "default") localStorage.setItem(BIOME_STORAGE_KEY, id);
    } catch (e) {}
  }

  // Entity lists: biomes declare which creatures/obstacles/powerUps they use; same implementation can be hot-swapped
  var DefaultBiome = {
    id: "default",
    name: "Cave",
    assetBasePath: "assets/audio",
    creatures: ["slime", "bat", "crawler"],
    obstacles: ["stalactite"],
    powerUps: ["lavaBounce", "fireTotem"],
    generateLevel: function (difficulty, seed, H) {
      return generateDefaultLevelLayout(difficulty, seed, H);
    }
  };

  // Desert biome constants
  var DESERT_PLATFORM_BASE_Y = 280;
  var CACTUS_W = 20;
  var CACTUS_H = 36;
  var CACTUS_NEEDLE_TRIGGER_DIST = 90;
  var CACTUS_SHAKE_DURATION = 0.4;
  var CACTUS_NEEDLE_COUNT = 4;
  var NEEDLE_SPEED = 180;
  var NEEDLE_R = 4;
  var SCORPION_W = 22;
  var SCORPION_H = 14;
  var SCORPION_SPEED = 45;
  var SCORPION_PATROL_MARGIN = 30;
  var BUZZARD_W = 26;
  var BUZZARD_H = 18;
  var BUZZARD_MAX_SPEED = 2.0 * REFERENCE_FPS;
  var BUZZARD_WANDER_STRENGTH = 0.45 * REFERENCE_FPS;

  var DESERT_MAX_JUMP_GAP = 220;
  var DESERT_CANYON_EXTRA_MIN = 35;
  var DESERT_CANYON_EXTRA_MAX = 95;

  function generateDesertLevelLayout(difficulty, seed, H) {
    var rng = makeRng(seed);
    var platforms = [];
    var start = { x: 40, y: DESERT_PLATFORM_BASE_Y, w: 200, h: 16 };
    platforms.push(start);
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var t = (dClamped - 1) / 29;
    // Canyons: base gap scales with difficulty; extra "canyon" gaps make pits you can fall into
    var baseGap = 85 + difficulty * 4;
    var baseW = 140 + difficulty * 5;
    var canyonChance = 0.08 + t * 0.22;
    var cx = start.x + start.w + 50;
    var cy = DESERT_PLATFORM_BASE_Y;
    var worldHeight = H || WORLD_H;
    var platCount = 16 + Math.floor(difficulty * 0.6);
    for (var i = 0; i < platCount; i++) {
      var gap = baseGap * rngRange(rng, 0.9, 1.2);
      if (rng() < canyonChance) {
        var extra = rngRange(rng, DESERT_CANYON_EXTRA_MIN + t * 40, DESERT_CANYON_EXTRA_MAX + t * 50);
        gap = Math.min(gap + extra, DESERT_MAX_JUMP_GAP);
      }
      cx += gap;
      if (cx > LEVEL_LENGTH - 200) break;
      var wiggle = rngRange(rng, -14, 14);
      var y = cy + wiggle;
      var useLong = rng() < 0.3 + t * 0.25;
      var w = useLong ? baseW * rngRange(rng, 1.6, 2.6) : baseW * rngRange(rng, 0.85, 1.25);
      w = Math.min(w, LEVEL_LENGTH - cx - 80);
      if (w < 50) continue;
      platforms.push({ x: cx, y: y, w: w, h: 16 });
      cy = cy * 0.7 + y * 0.3;
    }
    var last = platforms[platforms.length - 1];
    worldHeight = computeWorldHeightFromPlatforms(platforms);
    var goalX = Math.min(LEVEL_LENGTH - 100, last.x + last.w + 70);
    var goalY = last.y - 20;
    var goal = { x: goalX, y: goalY, w: 50, h: 80 };
    var worldMinY = Math.min(0, DESERT_PLATFORM_BASE_Y - 150);
    var worldMaxY = worldHeight;

    var options = { platforms: platforms, difficulty: dClamped, seed: seed, H: worldHeight, worldMinY: worldMinY, layout: {} };
    var genLayout = runBiomeGenerators(DesertBiome, options);
    var cactusDefs = genLayout.cactusDefs || [];

    var items = generateLavaBounceItem(seed + 888, worldHeight, platforms).concat(generateFireTotemItem(seed + 999, worldHeight, platforms));
    var checkpoints = generateCheckpoints(platforms, [], seed + 111, { stalactiteDefs: [], cactusDefs: cactusDefs });
    var dots = generateDots(platforms, seed + 444, goal, [], [], cactusDefs, []);

    return {
      platforms: platforms,
      goal: goal,
      worldHeight: worldHeight,
      worldMinY: worldMinY,
      worldMaxY: worldMaxY,
      ceilingPoints: [],
      stalactites: [],
      bats: [],
      slimes: [],
      crawlers: [],
      cactusDefs: cactusDefs,
      scorpionDefs: genLayout.scorpionDefs || [],
      buzzardDefs: genLayout.buzzardDefs || [],
      items: items,
      dots: dots,
      checkpoints: checkpoints
    };
  }

  var DesertBiome = {
    id: "desert",
    name: "Desert",
    assetBasePath: "assets/biomes/desert/audio",
    creatures: ["scorpion", "buzzard"],
    obstacles: ["cactus"],
    powerUps: ["lavaBounce", "fireTotem"],
    generateLevel: function (difficulty, seed, H) {
      return generateDesertLevelLayout(difficulty, seed, H);
    }
  };

  var BIOMES = { default: DefaultBiome, desert: DesertBiome };

  // Creature/obstacle generators: (options) -> defs; options = { platforms, difficulty, seed, H, layout }
  function generateScorpionDefs(platforms, difficulty, seed) {
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var scorpRng = makeRng(seed);
    var scorpCount = 2 + Math.floor(dClamped / 6);
    var defs = [];
    for (var si = 0; si < scorpCount; si++) {
      var platIdx = 1 + Math.floor(scorpRng() * (platforms.length - 2));
      var sp = platforms[platIdx];
      if (!sp) continue;
      var left = sp.x + SCORPION_PATROL_MARGIN;
      var right = sp.x + sp.w - SCORPION_PATROL_MARGIN;
      if (right - left < 40) continue;
      defs.push({
        platformIndex: platIdx,
        startX: left + scorpRng() * (right - left - 40),
        left: left,
        right: right,
        direction: scorpRng() < 0.5 ? 1 : -1
      });
    }
    return defs;
  }
  function generateBuzzardDefs(difficulty, seed, H) {
    var dClamped = Math.max(1, Math.min(30, difficulty));
    var buzzRng = makeRng(seed);
    var buzzCount = 1 + Math.floor(dClamped / 10);
    var worldHeight = H || WORLD_H;
    var defs = [];
    for (var bi = 0; bi < buzzCount; bi++) {
      defs.push({
        x: rngRange(buzzRng, 200, LEVEL_LENGTH - 200),
        y: rngRange(buzzRng, 60, worldHeight - 180),
        rngSeed: seed + 1000 + bi
      });
    }
    return defs;
  }
  function generateCactusDefs(platforms, seed) {
    var cactiRng = makeRng(seed);
    var defs = [];
    for (var pi = 1; pi < platforms.length - 1; pi++) {
      var plat = platforms[pi];
      if (!plat || plat.w < 50) continue;
      var numCacti = cactiRng() < 0.5 ? 0 : (cactiRng() < 0.7 ? 1 : 2);
      for (var nc = 0; nc < numCacti; nc++) {
        var offset = 0.15 + cactiRng() * 0.7;
        var variety = Math.floor(cactiRng() * 3);
        defs.push({ platformIndex: pi, offset: offset, variety: variety });
      }
    }
    return defs;
  }

  var CREATURE_GENERATORS = {
    slime: function (op) { return generateSlimesForPlatforms(op.platforms, op.difficulty, (op.seed || 0) + 999); },
    bat: function (op) { return generateBats(op.difficulty, (op.seed || 0) + 777, op.H); },
    crawler: function (op) { return generateCrawlers(op.platforms, op.layout.slimes || [], op.difficulty, (op.seed || 0) + 555); },
    scorpion: function (op) { return generateScorpionDefs(op.platforms, op.difficulty, (op.seed || 0) + 3000); },
    buzzard: function (op) { return generateBuzzardDefs(op.difficulty, (op.seed || 0) + 4000, op.H); }
  };
  var OBSTACLE_GENERATORS = {
    stalactite: function (op) {
      var cave = generateCeilingAndStalactites(op.difficulty, (op.seed || 0) + 321, op.platforms, op.H, op.worldMinY);
      return { ceilingPoints: cave.ceilingPoints, stalactites: cave.stalactites };
    },
    cactus: function (op) { return { cactusDefs: generateCactusDefs(op.platforms, (op.seed || 0) + 2000) }; }
  };
  var CREATURE_LAYOUT_KEY = { slime: "slimes", bat: "bats", crawler: "crawlers", scorpion: "scorpionDefs", buzzard: "buzzardDefs" };

  function runBiomeGenerators(biome, options) {
    var layout = options.layout || {};
    options.layout = layout;
    var o;
    for (o = 0; o < biome.obstacles.length; o++) {
      var obstType = biome.obstacles[o];
      if (OBSTACLE_GENERATORS[obstType]) {
        var r = OBSTACLE_GENERATORS[obstType](options);
        for (var key in r) layout[key] = r[key];
      }
    }
    for (o = 0; o < biome.creatures.length; o++) {
      var creatType = biome.creatures[o];
      if (CREATURE_GENERATORS[creatType]) {
        var layoutKey = CREATURE_LAYOUT_KEY[creatType] || creatType + "Defs";
        layout[layoutKey] = CREATURE_GENERATORS[creatType](options);
      }
    }
    return layout;
  }

  // --- Storage
  var LEVELS_STORAGE_KEY = "dragonLevels";
  var PROFILE_STORAGE_KEY = "dragonProfile";
  var AUDIO_STORAGE_KEY = "dragonAudio";
  var DIFFICULTY_STORAGE_KEY = "dragonDifficulty";
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

  function loadProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return { username: "", runs: [] };
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return { username: "", runs: [] };
      if (typeof data.username !== "string") data.username = "";
      if (!Array.isArray(data.runs)) data.runs = [];
      return data;
    } catch (e) {
      return { username: "", runs: [] };
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      // ignore storage errors in local/offline mode
    }
  }

  function getProfileUsername() {
    var p = loadProfile();
    return p.username || "";
  }

  function setProfileUsername(name) {
    var p = loadProfile();
    p.username = name || "";
    saveProfile(p);
  }

  function appendProfileRun(run) {
    var p = loadProfile();
    if (!Array.isArray(p.runs)) p.runs = [];
    p.runs.push(run);
    if (p.runs.length > 500) {
      p.runs = p.runs.slice(p.runs.length - 500);
    }
    saveProfile(p);
  }

  // --- Audio settings (SFX / music toggles)
  function loadAudioSettings() {
    try {
      var raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return { sfx: true, music: true };
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return { sfx: true, music: true };
      if (typeof data.sfx !== "boolean") data.sfx = true;
      if (typeof data.music !== "boolean") data.music = true;
      return data;
    } catch (e) {
      return { sfx: true, music: true };
    }
  }

  function saveAudioSettings(settings) {
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }

  function isSfxEnabled() {
    var s = loadAudioSettings();
    return s.sfx !== false;
  }

  function isMusicEnabled() {
    var s = loadAudioSettings();
    return s.music !== false;
  }

  function setSfxEnabled(enabled) {
    var s = loadAudioSettings();
    s.sfx = !!enabled;
    saveAudioSettings(s);
  }

  function setMusicEnabled(enabled) {
    var s = loadAudioSettings();
    s.music = !!enabled;
    saveAudioSettings(s);
  }

  // --- Difficulty setting (dropdown: "random" or 1-30)
  function loadDifficultySetting() {
    try {
      var raw = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
      if (!raw) return "1";
      var v = JSON.parse(raw);
      if (v === "random") return "random";
      var n = parseInt(v, 10);
      if (!n || n < 1 || n > 30) return "1";
      return String(n);
    } catch (e) {
      return "1";
    }
  }

  function saveDifficultySetting(value) {
    try {
      localStorage.setItem(DIFFICULTY_STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  }

  function getSelectedDifficultyValue() {
    var sel = document.getElementById("difficultySelect");
    if (!sel) return loadDifficultySetting();
    return sel.value || loadDifficultySetting();
  }

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
          biomeId: "default",
          platforms: layout.platforms,
          goal: layout.goal,
          worldHeight: layout.worldHeight,
          worldMinY: layout.worldMinY,
          worldMaxY: layout.worldMaxY,
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
        var lvlH = lvl.worldHeight || computeWorldHeightFromPlatforms(lvl.platforms) || H;
        if (!Array.isArray(lvl.ceiling) || !Array.isArray(lvl.stalactites)) {
          var cave = generateCeilingAndStalactites(lvl.difficulty || meta.difficulty, meta.seed + 321, lvl.platforms, lvlH);
          lvl.ceiling = cave.ceilingPoints;
          lvl.stalactites = cave.stalactites;
          changed = true;
        }
        if (lvl.worldHeight == null) { lvl.worldHeight = lvlH; changed = true; }
        if (!Array.isArray(lvl.bats)) {
          lvl.bats = generateBats(lvl.difficulty || meta.difficulty, meta.seed + 777, lvlH);
          changed = true;
        }
        if (!Array.isArray(lvl.items)) lvl.items = [];
        if (!lvl.items.some(function (i) { return i && i.type === "lavaBounce"; })) {
          lvl.items = lvl.items.concat(generateLavaBounceItem(meta.seed + 888, lvlH, lvl.platforms));
          changed = true;
        }
        if (!lvl.items.some(function (i) { return i && i.type === "fireTotem"; })) {
          lvl.items = lvl.items.concat(generateFireTotemItem(meta.seed + 999, lvlH, lvl.platforms));
          changed = true;
        }
        if (!Array.isArray(lvl.dots) || lvl.dots.length !== NUM_DOTS) {
          lvl.dots = generateDots(lvl.platforms || [], meta.seed + 444, lvl.goal, lvl.slimes || [], lvl.crawlers || [], lvl.cactusDefs || [], lvl.stalactites || []);
          changed = true;
        }
        if (!Array.isArray(lvl.checkpoints)) {
          lvl.checkpoints = generateCheckpoints(lvl.platforms, lvl.slimes || [], meta.seed + 111, { stalactiteDefs: lvl.stalactites || [], cactusDefs: lvl.cactusDefs || [] });
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
      : generateDots(platforms, (levelState.currentLevelSeed || 0) + 444, goal, levelState.slimeDefs || [], levelState.crawlerDefs || [], levelState.cactusDefs || [], levelState.stalactiteDefs || []);
    var biomeId = levelState.biomeId === "desert" ? "desert" : "default";
    var toPush = {
      id: levelID,
      name: name,
      biomeId: biomeId,
      platforms: platforms,
      goal: goal,
      worldHeight: levelState.H,
      worldMinY: levelState.worldMinY,
      worldMaxY: levelState.worldMaxY,
      bestScore: bestScore,
      bestDots: dots,
      difficulty: levelState.currentDifficulty,
      slimes: levelState.slimeDefs || [],
      ceiling: levelState.ceilingPoints || [],
      stalactites: levelState.stalactiteDefs || [],
      bats: levelState.batDefs || [],
      items: levelState.itemDefs || [],
      dots: dotDefs,
      checkpoints: levelState.checkpointDefs || [],
      crawlers: levelState.crawlerDefs || [],
      cactusDefs: levelState.cactusDefs || [],
      scorpionDefs: levelState.scorpionDefs || [],
      buzzardDefs: levelState.buzzardDefs || []
    };
    data.levels.push(toPush);
    saveAllLevels(data);
    if (typeof onSaved === "function") onSaved();
  }

  // --- Global input and level data (set by UI, read by scene)
  window.__dragonKeys = { left: false, right: false, jump: false, boost: false, breath: false };
  window.__dragonJumpKeyReleased = true;
  window.__dragonBreathKeyConsumed = false;
  window.__dragonLevelData = null;
  window.__dragonPopulateLevelDropdown = null;

  function buildLevelDataForNewSeed(seed, difficulty, biomeId) {
    difficulty = difficulty != null ? Math.max(1, Math.min(30, difficulty)) : 15;
    seed = Math.floor(Number(seed)) || 0;
    if (seed <= 0) return null;
    biomeId = biomeId || getSelectedBiomeId();
    var biome = BIOMES[biomeId] || DefaultBiome;
    var layout = biome.generateLevel(difficulty, seed, WORLD_H);
    return buildLevelDataFromLayout(layout, {
      currentLevelID: "seed-" + seed,
      currentLevelSeed: seed,
      currentDifficulty: difficulty,
      bestScore: Infinity,
      biomeId: biomeId
    });
  }

  function buildLevelDataForRandom(biomeId) {
    var difficulty = Math.floor(Math.random() * (23 - 8 + 1) + 8);
    var seed = Math.floor(Math.random() * 1e9);
    biomeId = biomeId || getSelectedBiomeId();
    var biome = BIOMES[biomeId] || DefaultBiome;
    var layout = biome.generateLevel(difficulty, seed, WORLD_H);
    return buildLevelDataFromLayout(layout, {
      currentLevelID: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "rand-" + seed,
      currentLevelSeed: seed,
      currentDifficulty: difficulty,
      bestScore: Infinity,
      biomeId: biomeId
    });
  }

  function buildLevelDataFromLayout(layout, meta) {
    var data = {
      currentLevelID: meta.currentLevelID,
      currentLevelSeed: meta.currentLevelSeed,
      currentDifficulty: meta.currentDifficulty,
      bestScore: meta.bestScore != null ? meta.bestScore : Infinity,
      biomeId: meta.biomeId || "default",
      platforms: layout.platforms,
      goal: layout.goal,
      worldHeight: layout.worldHeight,
      worldMinY: layout.worldMinY,
      worldMaxY: layout.worldMaxY,
      slimeDefs: layout.slimes || [],
      ceilingPoints: layout.ceilingPoints || [],
      stalactiteDefs: layout.stalactites || [],
      batDefs: layout.bats || [],
      itemDefs: layout.items || [],
      dotDefs: layout.dots || [],
      checkpointDefs: layout.checkpoints || [],
      crawlerDefs: layout.crawlers || [],
      cactusDefs: layout.cactusDefs || [],
      scorpionDefs: layout.scorpionDefs || [],
      buzzardDefs: layout.buzzardDefs || []
    };
    return data;
  }

  function buildLevelDataFromStored(level) {
    var platforms = JSON.parse(JSON.stringify(level.platforms));
    var goal = JSON.parse(JSON.stringify(level.goal));
    var worldHeight = level.worldHeight || computeWorldHeightFromPlatforms(platforms);
    var worldMinY = level.worldMinY != null ? level.worldMinY : 0;
    var worldMaxY = level.worldMaxY != null ? level.worldMaxY : worldHeight;
    var biomeId = level.biomeId === "desert" ? "desert" : "default";
    var crawlerDefs = [];
    var slimeDefs = [];
    var dotDefs;
    if (biomeId === "default") {
      slimeDefs = Array.isArray(level.slimes) ? level.slimes : [];
      crawlerDefs = Array.isArray(level.crawlers) && level.crawlers.length > 0
        ? level.crawlers
        : generateCrawlers(platforms, slimeDefs, level.difficulty != null ? level.difficulty : 15, (level.seed != null ? level.seed : 0) + 555);
      dotDefs = Array.isArray(level.dots) && level.dots.length === NUM_DOTS
        ? level.dots
        : generateDots(platforms, (level.seed != null ? level.seed : 0) + 444, goal, slimeDefs, crawlerDefs, undefined, level.stalactites || []);
    } else {
      crawlerDefs = [];
      dotDefs = Array.isArray(level.dots) && level.dots.length === NUM_DOTS
        ? level.dots
        : generateDots(platforms, (level.seed != null ? level.seed : 0) + 444, goal, [], [], level.cactusDefs || [], []);
    }
    var obstacleOpts = { stalactiteDefs: level.stalactites || [], cactusDefs: level.cactusDefs || [] };
    return {
      currentLevelID: level.id,
      currentLevelSeed: level.seed != null ? level.seed : null,
      currentDifficulty: level.difficulty != null ? level.difficulty : null,
      bestScore: level.bestScore,
      biomeId: biomeId,
      platforms: platforms,
      goal: goal,
      worldHeight: worldHeight,
      worldMinY: worldMinY,
      worldMaxY: worldMaxY,
      slimeDefs: slimeDefs,
      ceilingPoints: Array.isArray(level.ceiling) ? level.ceiling : [],
      stalactiteDefs: Array.isArray(level.stalactites) ? level.stalactites : [],
      batDefs: Array.isArray(level.bats) ? level.bats : [],
      itemDefs: Array.isArray(level.items) ? level.items : [],
      dotDefs: dotDefs,
      checkpointDefs: (Array.isArray(level.checkpoints) && level.checkpoints.length >= 2)
        ? level.checkpoints
        : generateCheckpoints(platforms, slimeDefs, (level.seed != null ? level.seed : 0) + 111, obstacleOpts),
      crawlerDefs: crawlerDefs,
      cactusDefs: Array.isArray(level.cactusDefs) ? level.cactusDefs : [],
      scorpionDefs: Array.isArray(level.scorpionDefs) ? level.scorpionDefs : [],
      buzzardDefs: Array.isArray(level.buzzardDefs) ? level.buzzardDefs : []
    };
  }

  // --- Phaser scene
  var GameScene = function () {
    Phaser.Scene.call(this, { key: "Game" });
  };
  GameScene.prototype = Object.create(Phaser.Scene.prototype);
  GameScene.prototype.constructor = GameScene;

  GameScene.prototype.preload = function () {
    // Audio assets (all optional; game still runs if a file is missing).
    // Put files in assets/audio/ with these names/formats:
    // - jump.mp3          (short, snappy jump)
    // - death.mp3         (dragon death)
    // - shield-loss.mp3   (lose fire totem / lava orb on hit)
    // - lava.mp3          (lava splash / sizzle)
    // - bat.mp3           (bat chitter)
    // - crawler.mp3       (crawler slide)
    // - slime.mp3         (slime jump)
    // - breath.mp3        (fire breath)
    // - platform-step.mp3 (stepping onto drop platform)
    // - platform-fall.mp3 (drop platform falling)
    // - win.mp3           (reach goal)
    // - music.mp3         (looping background track)
    // - boost.mp3         (air boost)
    // - dot.mp3           (collecting a dot)
    // - checkpoint.mp3    (touching a checkpoint; uses dot if missing)
    this.load.audio("checkpoint", "assets/audio/checkpoint.mp3");
    this.load.audio("jump", "assets/audio/jump.mp3");
    this.load.audio("death", "assets/audio/death.mp3");
    this.load.audio("shieldLoss", "assets/audio/shield-loss.mp3");
    this.load.audio("lavaHit", "assets/audio/lava.mp3");
    this.load.audio("batChitter", "assets/audio/bat.mp3");
    this.load.audio("crawlerSlide", "assets/audio/crawler.mp3");
    this.load.audio("slimeJump", "assets/audio/slime.mp3");
    this.load.audio("breath", "assets/audio/breath.mp3");
    this.load.audio("platformStep", "assets/audio/platform-step.mp3");
    this.load.audio("platformFall", "assets/audio/platform-fall.mp3");
    this.load.audio("win", "assets/audio/win.mp3");
    this.load.audio("music", "assets/audio/music.mp3");
    this.load.audio("boost", "assets/audio/boost.mp3");
    this.load.audio("dot", "assets/audio/dot.mp3");
    // Desert biome: optional overrides; same file names under assets/biomes/desert/audio/ (see .cursorrules)
    var desertBase = "assets/biomes/desert/audio/";
    this.load.audio("desert_jump", desertBase + "jump.mp3");
    this.load.audio("desert_death", desertBase + "death.mp3");
    this.load.audio("desert_shieldLoss", desertBase + "shield-loss.mp3");
    this.load.audio("desert_lavaHit", desertBase + "lava.mp3");
    this.load.audio("desert_breath", desertBase + "breath.mp3");
    this.load.audio("desert_platformStep", desertBase + "platform-step.mp3");
    this.load.audio("desert_platformFall", desertBase + "platform-fall.mp3");
    this.load.audio("desert_win", desertBase + "win.mp3");
    this.load.audio("desert_music", desertBase + "music.mp3");
    this.load.audio("desert_boost", desertBase + "boost.mp3");
    this.load.audio("desert_dot", desertBase + "dot.mp3");
    this.load.audio("desert_checkpoint", desertBase + "checkpoint.mp3");
    this.load.on("loaderror", function (file) {
      if (file && file.key && file.key.indexOf("desert_") === 0) {
        console.warn("[Dragon Lava Jump] Desert audio file missing (see .cursorrules for paths):", file.key);
      }
    });
  };

  GameScene.prototype.create = function () {
    var data = window.__dragonLevelData;
    if (!data) {
      data = buildLevelDataForRandom();
      window.__dragonLevelData = data;
    }

    this.LEVEL_LENGTH = LEVEL_LENGTH;
    this.worldMinY = data.worldMinY != null ? data.worldMinY : 0;
    this.worldMaxY = data.worldMaxY != null ? data.worldMaxY : (data.worldHeight || WORLD_H);
    this.WORLD_H = this.worldMaxY;
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
    this.biomeId = data.biomeId === "desert" ? "desert" : "default";
    this.cactusDefs = data.cactusDefs || [];
    this.scorpionDefs = data.scorpionDefs || [];
    this.buzzardDefs = data.buzzardDefs || [];

    // Biome-specific colors
    var platformColor = this.biomeId === "desert" ? 0xc4a574 : 0x8b5cf6;
    var lavaColor = this.biomeId === "desert" ? 0xb8860b : 0xff4b3e;
    var goalColor = this.biomeId === "desert" ? 0xdaa520 : 0xffd93d;

    // Log this level load into played history (even before completion)
    appendProfileRun({
      username: getProfileUsername(),
      timestamp: new Date().toISOString(),
      levelId: this.currentLevelID || null,
      seed: this.currentLevelSeed || null,
      difficulty: this.currentDifficulty != null ? this.currentDifficulty : null,
      timeSeconds: null,
      dotsCollected: 0,
      dotsTotal: NUM_DOTS
    });
    if (typeof window.__dragonPopulatePlayedDropdown === "function") window.__dragonPopulatePlayedDropdown();

    this.lastCheckpointIndex = -1;
    this.lives = LIVES_START;
    this.lavaY = this.worldMaxY - 50;
    this.timerStarted = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.gameWon = false;
    this.winSequenceState = "idle";
    this.winHoldTimer = 0;
    this.isDyingInLava = false;
    this.lavaDeathTimer = 0;
    this.lavaBounceTimer = 0;
    this.lavaBounceItemCollected = false;
    this.lavaBounceBounces = 0;  // lava touches this run (reset on platform land)
    this.lavaBounceTotalUses = 0;  // total bounces with orb; orb is lost after 3
    this.lavaBounceCooldownUntil = 0;  // avoid counting one fall as multiple touches
    this.fireTotemCollected = false;
    this.fireBreathsLeft = 0;
    this.breathActiveTime = 0;
    this.dotsCollected = this.dotDefs.map(function () { return false; });
    this.dotsCollectedCount = 0;
    this.standingPlatformIndex = -1;
    this.doubleJumpUsedThisFlight = false;  // only reset when landing on real platform; gates exactly one double jump per flight
    this.doubleJumpPlatform = null;
    this.wasOnDoubleJumpPlat = false;
    this.cameraX = 0;

    // Instantiate sounds: Desert overrides default when file exists in assets/biomes/desert/audio/
    var soundKey = function (defaultK, desertK) {
      return (this.biomeId === "desert" && this.cache.audio.exists(desertK)) ? desertK : defaultK;
    }.bind(this);
    var keyJump = soundKey("jump", "desert_jump");
    var keyDeath = soundKey("death", "desert_death");
    var keyShieldLoss = soundKey("shieldLoss", "desert_shieldLoss");
    var keyLavaHit = soundKey("lavaHit", "desert_lavaHit");
    var keyBat = soundKey("batChitter", "desert_batChitter");
    var keyCrawler = soundKey("crawlerSlide", "desert_crawlerSlide");
    var keySlime = soundKey("slimeJump", "desert_slimeJump");
    var keyBreath = soundKey("breath", "desert_breath");
    var keyPlatformStep = soundKey("platformStep", "desert_platformStep");
    var keyPlatformFall = soundKey("platformFall", "desert_platformFall");
    var keyWin = soundKey("win", "desert_win");
    var keyMusic = soundKey("music", "desert_music");
    var keyBoost = soundKey("boost", "desert_boost");
    var keyDot = soundKey("dot", "desert_dot");
    var keyCheckpoint = soundKey("checkpoint", "desert_checkpoint");
    this.jumpSound = this.cache.audio.exists(keyJump) ? this.sound.add(keyJump, { volume: 0.5 }) : null;
    this.deathSound = this.cache.audio.exists(keyDeath) ? this.sound.add(keyDeath, { volume: 0.7 }) : null;
    this.shieldLossSound = this.cache.audio.exists(keyShieldLoss) ? this.sound.add(keyShieldLoss, { volume: 0.7 }) : null;
    this.lavaHitSound = this.cache.audio.exists(keyLavaHit) ? this.sound.add(keyLavaHit, { volume: 0.8 }) : null;
    this.batSound = this.cache.audio.exists(keyBat) ? this.sound.add(keyBat, { volume: 0.4 }) : null;
    this.crawlerSound = this.cache.audio.exists(keyCrawler) ? this.sound.add(keyCrawler, { volume: 0.7 }) : null;
    this.slimeSound = this.cache.audio.exists(keySlime) ? this.sound.add(keySlime, { volume: 0.5 }) : null;
    this.breathSound = this.cache.audio.exists(keyBreath) ? this.sound.add(keyBreath, { volume: 0.5 }) : null;
    this.platformStepSound = this.cache.audio.exists(keyPlatformStep) ? this.sound.add(keyPlatformStep, { volume: 0.6 }) : null;
    this.platformFallSound = this.cache.audio.exists(keyPlatformFall) ? this.sound.add(keyPlatformFall, { volume: 0.6 }) : null;
    this.winSound = this.cache.audio.exists(keyWin) ? this.sound.add(keyWin, { volume: 0.7 }) : null;
    this.boostSound = this.cache.audio.exists(keyBoost) ? this.sound.add(keyBoost, { volume: 0.6 }) : null;
    this.dotSound = this.cache.audio.exists(keyDot) ? this.sound.add(keyDot, { volume: 0.8 }) : null;
    this.checkpointSound = this.cache.audio.exists(keyCheckpoint) ? this.sound.add(keyCheckpoint, { volume: 0.7 }) : (this.cache.audio.exists(keyDot) ? this.sound.add(keyDot, { volume: 0.7 }) : null);
    this.music = null;
    if (this.cache.audio.exists(keyMusic)) {
      var existingMusic = (typeof this.sound.get === "function") ? this.sound.get(keyMusic) : null;
      if (existingMusic) {
        this.music = existingMusic;
        this.music.setLoop(true);
        var enableMusic = isMusicEnabled();
        this.music.setMute(!enableMusic);
        if (enableMusic && !this.music.isPlaying) this.music.play();
      } else {
        this.music = this.sound.add(keyMusic, { volume: 0.35, loop: true });
        if (isMusicEnabled()) this.music.play();
        else this.music.setMute(true);
      }
    }

    this.physics.world.setBounds(0, this.worldMinY, LEVEL_LENGTH, this.worldMaxY - this.worldMinY);
    this.physics.world.gravity.y = gravity;

    // Desert: sandy sky background
    if (this.biomeId === "desert") {
      var bgY = (this.worldMinY + this.worldMaxY) / 2;
      var bgH = this.worldMaxY - this.worldMinY + 200;
      this.add.rectangle(LEVEL_LENGTH / 2, bgY, LEVEL_LENGTH + 100, bgH, 0xedc9a0).setDepth(-10);
    }

    // Platforms (static) - use rectangles; bent is visual only, collision is AABB
    this.platformGroup = this.physics.add.staticGroup();
    this.platformSprites = [];
    for (var i = 0; i < this.platformsData.length; i++) {
      var p = this.platformsData[i];
      var rect = this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, platformColor);
      this.physics.add.existing(rect, true);
      // One-way platforms: collide only on top so you can walk through ends
      rect.body.checkCollision.down = false;
      rect.body.checkCollision.left = false;
      rect.body.checkCollision.right = false;
      this.platformGroup.add(rect);
      rect.setData("platformIndex", i);
      rect.setData("platformData", p);
      this.platformSprites.push(rect);
    }

    // Lava zone (physics) + visible lava/quicksand strip - at bottom of dynamic world
    var lavaCenterY = this.worldMaxY - 30;
    this.lavaZone = this.add.rectangle(LEVEL_LENGTH / 2, lavaCenterY, LEVEL_LENGTH, 60, lavaColor, 0);
    this.physics.add.existing(this.lavaZone, true);
    this.lavaZone.body.updateFromGameObject = function () {};
    this.lavaSprite = this.add.rectangle(LEVEL_LENGTH / 2, lavaCenterY + 15, LEVEL_LENGTH, 30, lavaColor, 1)
      .setDepth(0);
    // Keep a cached lava top for bounce positioning
    this.lavaY = this.lavaZone.y - this.lavaZone.height / 2;

    // Goal
    this.goalZone = this.add.rectangle(
      this.goal.x + this.goal.w / 2,
      this.goal.y + this.goal.h / 2,
      this.goal.w,
      this.goal.h,
      goalColor
    );
    this.physics.add.existing(this.goalZone, true);
    this.goalZone.body.updateFromGameObject = function () {};

    // Player - blocky Atari-style dragon: body rectangle + separate head/eye positioned by facing
    this.player = this.add.rectangle(0, 0, DRAGON_W, DRAGON_H, 0x4a9b4a);
    this.playerHead = this.add.rectangle(0, 0, 6, 12, 0x3d8b3d).setDepth(21);
    this.playerEye = this.add.rectangle(0, 0, 3, 3, 0xffffff).setDepth(21);
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

    // Default biome: slimes, bats, crawlers, stalactites. Desert: cacti, scorpions, buzzards.
    this.slimes = [];
    this.slimeEyes = [];
    this.bats = [];
    this.batParts = [];
    this.crawlers = [];
    this.crawlerEyes = [];
    this.stalactites = [];
    this.cacti = [];
    this.cactusHitboxes = [];
    this.scorpions = [];
    this.buzzards = [];
    this.buzzardParts = [];
    this.needles = [];

    if (this.biomeId === "default") {
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
      // Slightly shrink slime hitbox for fairer collisions
      slime.body.setSize(slimeW - 6, slimeH - 4);
      slime.body.setOffset(3, 2);
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
      // Cute slime eyes (purely visual)
      var eyeOffsetX = 4;
      var eyeY = -3;
      var eye1 = this.add.rectangle(slime.x - eyeOffsetX, slime.y + eyeY, 3, 3, 0xffffff).setDepth(slime.depth + 1);
      var eye2 = this.add.rectangle(slime.x + eyeOffsetX, slime.y + eyeY, 3, 3, 0xffffff).setDepth(slime.depth + 1);
      this.slimeEyes.push({ body: slime, eye1: eye1, eye2: eye2 });
    }

    // Bats
    for (var bi = 0; bi < this.batDefs.length; bi++) {
      var bdef = this.batDefs[bi];
      // Bright body color so they stand out from the dark background
      var bat = this.add.rectangle(bdef.x + BAT_W / 2, bdef.y + BAT_H / 2, BAT_W, BAT_H, 0xff6b6b)
        .setDepth(50);
      this.physics.add.existing(bat, false);
      bat.body.setAllowGravity(false);
      bat.body.setVelocity(0, 0);
      bat.setData("rng", makeRng(bdef.rngSeed != null ? bdef.rngSeed : bi));
      bat.setData("vx", 0);
      bat.setData("vy", 0);
      this.bats.push(bat);
      // Cute bat wings + eyes (visual only)
      var wingSpan = 10;
      var wingY = 0;
      var leftWing = this.add.rectangle(bat.x - wingSpan, bat.y + wingY, BAT_W / 2, BAT_H / 2, 0x9ca3af).setDepth(bat.depth - 1);
      var rightWing = this.add.rectangle(bat.x + wingSpan, bat.y + wingY, BAT_W / 2, BAT_H / 2, 0x9ca3af).setDepth(bat.depth - 1);
      var eyeOffset = 3;
      var eyeYb = -3;
      var eyeL = this.add.rectangle(bat.x - eyeOffset, bat.y + eyeYb, 2, 2, 0xffffff).setDepth(bat.depth + 1);
      var eyeR = this.add.rectangle(bat.x + eyeOffset, bat.y + eyeYb, 2, 2, 0xffffff).setDepth(bat.depth + 1);
      this.batParts.push({ body: bat, leftWing: leftWing, rightWing: rightWing, eyeL: eyeL, eyeR: eyeR });
    }

    // Crawlers
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
      // Cute crawler eyes
      var cEyeOffset = 3;
      var cEyeY = -3;
      var cEye1 = this.add.rectangle(crawler.x - cEyeOffset, crawler.y + cEyeY, 2, 2, 0xffffff).setDepth(crawler.depth + 1);
      var cEye2 = this.add.rectangle(crawler.x + cEyeOffset, crawler.y + cEyeY, 2, 2, 0xffffff).setDepth(crawler.depth + 1);
      this.crawlerEyes.push({ body: crawler, eye1: cEye1, eye2: cEye2 });
    }

    // Stalactites (pointy triangles hanging from ceiling + rectangle hitbox)
    for (var sti = 0; sti < this.stalactiteDefs.length; sti++) {
      var st = this.stalactiteDefs[sti];
      var sx = st.x;
      var sy = st.y;
      var sw = st.w || 24;
      var sh = st.length || 40;
      // Invisible rectangular hitbox
      var rect = this.add.rectangle(sx, sy + sh / 2, sw, sh, 0x000000, 0);
      this.physics.add.existing(rect, true);
      rect.body.updateFromGameObject = function () {};
      this.stalactites.push(rect);
      // Visible pointy stalactite graphic
      var gfx = this.add.graphics().setDepth(1);
      gfx.fillStyle(0x3f2b63, 1);
      gfx.fillTriangle(sx - sw / 2, sy, sx + sw / 2, sy, sx, sy + sh);
    }
    } else if (this.biomeId === "desert") {
      // Cacti (3 varieties: saguaro, barrel, needle-shooter) - hitbox + visual
      for (var ci = 0; ci < this.cactusDefs.length; ci++) {
        var cdef = this.cactusDefs[ci];
        var cplat = this.platformsData[cdef.platformIndex];
        if (!cplat) continue;
        var cx = cplat.x + cdef.offset * cplat.w;
        var cy = cplat.y - CACTUS_H / 2;
        var hitbox = this.add.rectangle(cx, cy, CACTUS_W, CACTUS_H, 0x000000, 0);
        this.physics.add.existing(hitbox, true);
        hitbox.body.updateFromGameObject = function () {};
        hitbox.setData("defIndex", ci);
        hitbox.setData("variety", cdef.variety);
        hitbox.setData("shakeTimer", 0);
        hitbox.setData("fired", false);
        this.cactusHitboxes.push(hitbox);
        var gfx = this.add.graphics().setDepth(2);
        if (cdef.variety === 0) {
          gfx.fillStyle(0x2d5a27, 1);
          gfx.fillRect(cx - 5, cy - CACTUS_H / 2 + 4, 10, CACTUS_H - 8);
          gfx.fillStyle(0x3d7a35, 1);
          gfx.fillRect(cx - 8, cy - 4, 6, 12);
          gfx.fillRect(cx + 2, cy - 10, 5, 10);
        } else if (cdef.variety === 1) {
          gfx.fillStyle(0x4a7c3a, 1);
          gfx.fillEllipse(cx, cy, 14, CACTUS_H - 4);
          gfx.fillStyle(0x3a6c2a, 1);
          gfx.fillEllipse(cx - 4, cy + 4, 6, 10);
        } else {
          gfx.fillStyle(0x2d5a27, 1);
          gfx.fillRect(cx - 4, cy - CACTUS_H / 2 + 2, 8, CACTUS_H - 4);
          gfx.fillStyle(0x1a3a17, 1);
          for (var n = 0; n < 6; n++) gfx.fillCircle(cx + (n % 2) * 6 - 3, cy - CACTUS_H / 2 + 6 + n * 6, 2);
        }
        this.cacti.push({ hitbox: hitbox, gfx: gfx, def: cdef });
      }
      // Scorpions (patrol on platform)
      for (var sci = 0; sci < this.scorpionDefs.length; sci++) {
        var sdef = this.scorpionDefs[sci];
        var splat = this.platformsData[sdef.platformIndex];
        if (!splat) continue;
        var sy = splat.y - SCORPION_H / 2;
        var scorp = this.add.rectangle(sdef.startX, sy, SCORPION_W, SCORPION_H, 0x5c4033);
        this.physics.add.existing(scorp, false);
        scorp.body.setAllowGravity(false);
        scorp.body.setVelocity(0, 0);
        scorp.setData("left", sdef.left);
        scorp.setData("right", sdef.right);
        scorp.setData("direction", sdef.direction);
        scorp.setData("defIndex", sci);
        this.scorpions.push(scorp);
      }
      // Buzzards (fly like bats)
      for (var bzi = 0; bzi < this.buzzardDefs.length; bzi++) {
        var bzdef = this.buzzardDefs[bzi];
        var buzz = this.add.rectangle(bzdef.x + BUZZARD_W / 2, bzdef.y + BUZZARD_H / 2, BUZZARD_W, BUZZARD_H, 0x4a3728).setDepth(50);
        this.physics.add.existing(buzz, false);
        buzz.body.setAllowGravity(false);
        buzz.body.setVelocity(0, 0);
        buzz.setData("rng", makeRng(bzdef.rngSeed != null ? bzdef.rngSeed : bzi));
        buzz.setData("vx", 0);
        buzz.setData("vy", 0);
        this.buzzards.push(buzz);
        var wingL = this.add.rectangle(buzz.x - 8, buzz.y + 2, BUZZARD_W / 2, BUZZARD_H / 2, 0x3d2e22).setDepth(buzz.depth - 1);
        var wingR = this.add.rectangle(buzz.x + 8, buzz.y + 2, BUZZARD_W / 2, BUZZARD_H / 2, 0x3d2e22).setDepth(buzz.depth - 1);
        this.buzzardParts.push({ body: buzz, wingL: wingL, wingR: wingR });
      }
      this.needleGroup = this.physics.add.group();
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

    // Checkpoints (2 per level at ~1/3 and ~2/3) - visible pole + flag, overlap zone
    this.checkpointZones = [];
    this.checkpointVfx = [];
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
      var pole = this.add.rectangle(poleCenterX, poleTop + POLE_H / 2, 4, POLE_H, 0x718096).setDepth(18);
      var flag = this.add.rectangle(poleCenterX + 6, poleTop + 4, 12, 8, 0x48bb78).setDepth(18);
      this.checkpointVfx.push({ pole: pole, flag: flag });
    }

    // Items
    this.itemZones = [];
    this.itemVfx = [];
    for (var ii = 0; ii < this.itemDefs.length; ii++) {
      var it = this.itemDefs[ii];
      var iz = this.add.rectangle(it.x + it.w / 2, it.y + it.h / 2, it.w, it.h, 0xffffff, 0); // invisible hitbox
      this.physics.add.existing(iz, true);
      iz.body.updateFromGameObject = function () {};
      iz.setData("item", it);
      iz.setData("collected", false);
      this.itemZones.push(iz);
      // Visuals for items
      if (it.type === "lavaBounce") {
        var orb = this.add.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w, it.h, 0xffb84d).setDepth(iz.depth + 1);
        this.itemVfx.push({ zone: iz, type: "lavaBounce", sprite: orb });
      } else if (it.type === "fireTotem") {
        var base = this.add.rectangle(it.x + it.w / 2, it.y + it.h - 8, it.w - 8, 12, 0x5c4a3a).setDepth(iz.depth + 1);
        var mid = this.add.rectangle(it.x + it.w / 2, it.y + it.h - 16, it.w - 12, 6, 0x6b5a4a).setDepth(iz.depth + 1);
        var flame = this.add.ellipse(it.x + it.w / 2, it.y, it.w - 6, it.h - 6, 0xffb84d).setDepth(iz.depth + 2);
        this.itemVfx.push({ zone: iz, type: "fireTotem", base: base, mid: mid, flame: flame });
      }
    }

    // Fire breath visuals (created when breathing)
    this.breathZone = null;
    this.breathSprite = this.add.rectangle(this.player.x, this.player.y, BREATH_LEN, DRAGON_H - 8, 0xffb84d, 0.7)
      .setVisible(false)
      .setDepth(this.player.depth - 1);

    this.physics.add.collider(this.player, this.platformGroup, null, null, this);
    this.physics.add.overlap(this.player, this.lavaZone, this.onOverlapLava, null, this);
    this.physics.add.overlap(this.player, this.goalZone, this.onOverlapGoal, null, this);
    this.physics.add.overlap(this.player, this.dotSprites, this.onOverlapDot, null, this);
    this.physics.add.overlap(this.player, this.checkpointZones, this.onOverlapCheckpoint, null, this);
    this.physics.add.overlap(this.player, this.itemZones, this.onOverlapItem, null, this);
    if (this.biomeId === "default") {
      this.physics.add.overlap(this.player, this.slimes, this.onOverlapSlime, null, this);
      this.physics.add.overlap(this.player, this.bats, this.onOverlapBat, null, this);
      this.physics.add.overlap(this.player, this.crawlers, this.onOverlapCrawler, null, this);
      this.physics.add.overlap(this.player, this.stalactites, this.onOverlapStalactite, null, this);
    } else if (this.biomeId === "desert") {
      this.physics.add.overlap(this.player, this.cactusHitboxes, this.onOverlapCactus, null, this);
      this.physics.add.overlap(this.player, this.scorpions, this.onOverlapScorpion, null, this);
      this.physics.add.overlap(this.player, this.buzzards, this.onOverlapBuzzard, null, this);
      this.physics.add.overlap(this.player, this.needleGroup, this.onOverlapNeedle, null, this);
    }

    this.cameras.main.setBounds(0, this.worldMinY, LEVEL_LENGTH, this.worldMaxY - this.worldMinY);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(0, 0);
    // On smaller screens, zoom out a bit so you can see more of the level
    try {
      var vw = window.innerWidth || 640;
      var vh = window.innerHeight || 360;
      // Base zoom of 1 on desktop; reduce to show more world on shorter viewports
      var zoom = 1;
      if (vh < 800) {
        zoom = Math.max(0.7, vh / 600);
      }
      this.cameras.main.setZoom(zoom);
    } catch (_) {}

    this.hudText = this.add.text(16, 14, "", { fontSize: "14px", color: "#fff", backgroundColor: "#00000088" }).setScrollFactor(0).setDepth(100);
    if (this.hudText.setPadding) this.hudText.setPadding(8, 4);
  };

  // Play SFX or log to console when file is missing (see .cursorrules for required files)
  GameScene.prototype.playSfx = function (soundRef, nameForLog, playOptions) {
    if (soundRef && isSfxEnabled()) {
      if (playOptions != null) soundRef.play(playOptions);
      else soundRef.play();
    } else if (isSfxEnabled()) {
      console.warn("[Dragon Lava Jump] Sound not available (missing file):", nameForLog);
    }
  };

  GameScene.prototype.updateHUD = function () {
    var bestStr = (this.bestScore !== Infinity && isFinite(this.bestScore)) ? this.bestScore.toFixed(2) : "--";
    var livesStr = "\u2665".repeat(this.lives) + "\u2661".repeat(LIVES_START - this.lives);
    var diffStr = this.currentDifficulty != null ? " (Diff " + Math.max(1, Math.min(30, Math.floor(this.currentDifficulty))) + ")" : "";
    var levelStr = (this.currentLevelSeed != null && this.currentLevelSeed > 0) ? String(this.currentLevelSeed) : (this.currentLevelID || "--");
    var flameStr = this.fireBreathsLeft > 0 ? "\nFlame (G)" : "";
    var lavaStr = "";
    if (this.lavaBounceItemCollected) {
      var lavaLeft = Math.max(0, 3 - (this.lavaBounceTotalUses || 0));
      lavaStr = "\nLava: " + lavaLeft + " left";
    }
    this.hudText.setText(
      "Time: " + this.currentTime.toFixed(2) + "  Best: " + bestStr + "\nDots: " + this.dotsCollectedCount + "/" + NUM_DOTS + "  Lives: " + livesStr + "\nLevel: " + levelStr + diffStr + flameStr + lavaStr
    );
  };

  GameScene.prototype.onOverlapLava = function (player, zone) {
    if (this.gameWon || this.isDyingInLava) return;
    var maxBouncesPerRun = 2;
    if (this.lavaBounceItemCollected && this.lavaBounceBounces < maxBouncesPerRun) {
      // One touch per "fall": overlap can fire every frame, so only count once per entry.
      var now = (typeof this.sceneTime === "number") ? this.sceneTime : 0;
      var isNewTouch = now >= (this.lavaBounceCooldownUntil || 0);
      if (isNewTouch) {
        this.lavaBounceBounces++;
        this.lavaBounceTotalUses++;
        this.lavaBounceCooldownUntil = now + 400;
      }
      this.player.body.setVelocityY(LAVA_BOUNCE_VY);
      var lavaTop = this.lavaZone.y - this.lavaZone.height / 2;
      this.lavaY = lavaTop;
      this.player.y = lavaTop - 2 - DRAGON_H / 2;
      this.player.onGround = false;
      this.player.jumpsLeft = 1;
      this.player.boostAvailable = false;
      this.doubleJumpUsedThisFlight = false;  // one double jump allowed after bounce
      if (this.lavaBounceTotalUses >= 3) {
        this.lavaBounceItemCollected = false;
        this.lavaBounceBounces = 0;
        this.playSfx(this.shieldLossSound, "shieldLoss");
      }
      return;
    }
    this.playSfx(this.lavaHitSound, "lavaHit");
    this.isDyingInLava = true;
    this.lavaDeathTimer = LAVA_DEATH_DURATION;
  };

  GameScene.prototype.onOverlapGoal = function (player, zone) {
    if (this.gameWon) return;
    this.gameWon = true;
    this.winSequenceState = "entering";

    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);
    this.player.body.enable = false;

    var goalCenterX = this.goal.x + this.goal.w / 2;
    var goalCenterY = this.goal.y + this.goal.h / 2;

    if (this.music && isMusicEnabled()) {
      var startVol = this.music.volume !== undefined ? this.music.volume : 0.35;
      this.tweens.addCounter({
        from: startVol,
        to: 0.12,
        duration: 600,
        onUpdate: function (tween) {
          if (this.music && this.music.setVolume) this.music.setVolume(tween.getValue());
        },
        callbackScope: this
      });
    }
    this.playSfx(this.winSound, "win");

    var enterDuration = 1200;
    this.tweens.add({
      targets: this.player,
      x: goalCenterX,
      y: goalCenterY,
      scaleX: 0,
      scaleY: 0,
      angle: 360,
      duration: enterDuration,
      ease: "Cubic.easeIn",
      onComplete: function () {
        this.winSequenceState = "holding";
        this.winHoldTimer = 1.8;
      },
      callbackScope: this
    });

    var levelState = {
      H: this.WORLD_H,
      worldMinY: this.worldMinY,
      worldMaxY: this.worldMaxY,
      currentDifficulty: this.currentDifficulty,
      biomeId: this.biomeId || "default",
      slimeDefs: this.slimeDefs || [],
      ceilingPoints: this.ceilingPoints || [],
      stalactiteDefs: this.stalactiteDefs || [],
      batDefs: this.batDefs || [],
      itemDefs: this.itemDefs || [],
      dotDefs: this.dotDefs || [],
      checkpointDefs: this.checkpointDefs || [],
      crawlerDefs: this.crawlerDefs || [],
      cactusDefs: this.cactusDefs || [],
      scorpionDefs: this.scorpionDefs || [],
      buzzardDefs: this.buzzardDefs || [],
      currentLevelSeed: this.currentLevelSeed
    };

    // Log completed run to profile (mock sign-in).
    var username = "";
    try {
      var input = document.getElementById("usernameInput");
      if (input && input.value) username = input.value.trim();
    } catch (_) {}
    if (!username) {
      username = getProfileUsername();
    }
    appendProfileRun({
      username: username || "",
      timestamp: new Date().toISOString(),
      levelId: this.currentLevelID || null,
      seed: this.currentLevelSeed || null,
      difficulty: this.currentDifficulty != null ? this.currentDifficulty : null,
      timeSeconds: this.currentTime,
      dotsCollected: this.dotsCollectedCount,
      dotsTotal: NUM_DOTS
    });
    if (typeof window.__dragonPopulatePlayedDropdown === "function") window.__dragonPopulatePlayedDropdown();

    // For predefined levels, silently update stored bests (no naming prompts).
    var data = loadAllLevels(this.WORLD_H);
    var existing = data.levels.find(function (l) { return l.id === this.currentLevelID; }.bind(this));
    if (existing) {
      saveCompletedLevel(existing.id, existing.name, this.platformsData, this.goal, this.currentTime, this.dotsCollectedCount, levelState, window.__dragonPopulateLevelDropdown);
    }
    if (typeof this.bestScore !== "number" || !isFinite(this.bestScore) || this.currentTime < this.bestScore) {
      this.bestScore = this.currentTime;
    }
    if (typeof window.__dragonPopulateLevelDropdown === "function") window.__dragonPopulateLevelDropdown();
  };

  GameScene.prototype.spawnDoubleJumpPlatform = function () {
    var centerX = this.player.x;
    var topY = this.player.y + DRAGON_H / 2;
    var centerY = topY + DOUBLE_JUMP_PLAT_H / 2;
    var glow = this.add.rectangle(centerX, centerY, DOUBLE_JUMP_PLAT_W + 6, DOUBLE_JUMP_PLAT_H + 4, 0x7c3aed);
    glow.setDepth(14);
    glow.setAlpha(0.6);
    glow.setData("doubleJumpPlatform", true);
    var plat = this.add.rectangle(centerX, centerY, DOUBLE_JUMP_PLAT_W, DOUBLE_JUMP_PLAT_H, 0xa78bfa);
    plat.setDepth(15);
    plat.setData("doubleJumpPlatform", true);
    plat.setData("used", false);
    this.doubleJumpPlatform = plat;
    this.physics.add.existing(plat, true);
    plat.body.checkCollision.down = false;
    plat.body.checkCollision.left = false;
    plat.body.checkCollision.right = false;
    plat.body.updateFromGameObject = function () {};
    this.platformGroup.add(plat);
    plat.setData("glow", glow);
    var scene = this;
    this.time.delayedCall(DOUBLE_JUMP_PLAT_VISIBLE_MS, function () {
      if (!plat.scene) return;
      scene.tweens.add({
        targets: [plat, glow],
        alpha: 0,
        duration: DOUBLE_JUMP_PLAT_FADE_DURATION,
        onComplete: function () {
          if (plat.scene && scene.platformGroup) scene.platformGroup.remove(plat);
          if (glow.scene) glow.destroy();
          plat.destroy();
          if (scene.doubleJumpPlatform === plat) scene.doubleJumpPlatform = null;
        }
      });
    });
  };

  GameScene.prototype.onOverlapDot = function (player, dot) {
    if (dot.getData("collected")) return;
    var idx = dot.getData("index");
    this.dotsCollected[idx] = true;
    this.dotsCollectedCount++;
    this.playSfx(this.dotSound, "dot");
    dot.setData("collected", true);
    dot.setVisible(false);
    dot.body.checkCollision.none = true;
  };

  GameScene.prototype.onOverlapCheckpoint = function (player, zone) {
    var idx = zone.getData("index");
    if (idx > this.lastCheckpointIndex) {
      this.lastCheckpointIndex = idx;
      this.playSfx(this.checkpointSound, "checkpoint");
      var vfx = this.checkpointVfx[idx];
      if (vfx) {
        vfx.flag.fillColor = 0xffd93d;
        vfx.pole.fillColor = 0xa3b18a;
      }
    }
  };

  GameScene.prototype.onOverlapItem = function (player, zone) {
    if (zone.getData("collected")) return;
    var it = zone.getData("item");
    if (it.type === "lavaBounce") {
      // Lava orb: grants lava bounces (2 per run) until 3 total uses or hit by enemy.
      this.lavaBounceItemCollected = true;
      this.lavaBounceBounces = 0;
      this.lavaBounceTotalUses = 0;
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
      if (this.shieldLossSound && isSfxEnabled()) this.shieldLossSound.play();
      this.killSlime(slime);
      this.fireBreathsLeft = 0;
      this.fireTotemCollected = false;
      // Using a shielded hit clears any lava shield as well (no stacking hits)
      this.lavaBounceItemCollected = false;
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
      if (this.shieldLossSound && isSfxEnabled()) this.shieldLossSound.play();
      this.killCrawler(crawler);
      this.fireBreathsLeft = 0;
      this.fireTotemCollected = false;
      this.lavaBounceItemCollected = false;
      return;
    }
    this.applyDeath();
  };

  GameScene.prototype.onOverlapStalactite = function (player, st) {
    this.applyDeath();
  };

  GameScene.prototype.onOverlapCactus = function (player, hitbox) {
    this.applyDeath();
  };

  GameScene.prototype.onOverlapScorpion = function (player, scorp) {
    this.applyDeath();
  };

  GameScene.prototype.onOverlapBuzzard = function (player, buzz) {
    this.applyDeath();
  };

  GameScene.prototype.onOverlapNeedle = function (player, needle) {
    this.applyDeath();
  };

  // Simple death animations for monsters: shrink + fade, then disable collisions
  GameScene.prototype.killSlime = function (slime) {
    if (slime.getData("dead")) return;
    slime.setData("dead", true);
    slime.body.checkCollision.none = true;
    // Hide eyes immediately
    for (var i = 0; i < this.slimeEyes.length; i++) {
      var info = this.slimeEyes[i];
      if (info.body === slime) {
        info.eye1.setVisible(false);
        info.eye2.setVisible(false);
      }
    }
    this.tweens.add({
      targets: slime,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 220,
      onComplete: function () {
        slime.setVisible(false);
      }
    });
  };

  GameScene.prototype.killCrawler = function (crawler) {
    if (crawler.getData("dead")) return;
    crawler.setData("dead", true);
    crawler.body.checkCollision.none = true;
    // Hide eyes immediately
    for (var i = 0; i < this.crawlerEyes.length; i++) {
      var info = this.crawlerEyes[i];
      if (info.body === crawler) {
        info.eye1.setVisible(false);
        info.eye2.setVisible(false);
      }
    }
    this.tweens.add({
      targets: crawler,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 220,
      onComplete: function () {
        crawler.setVisible(false);
      }
    });
  };

  GameScene.prototype.killBat = function (bat) {
    // Find visual parts for this bat
    var parts = null;
    for (var i = 0; i < this.batParts.length; i++) {
      if (this.batParts[i].body === bat) {
        parts = this.batParts[i];
        break;
      }
    }
    var targets = parts
      ? [bat, parts.leftWing, parts.rightWing, parts.eyeL, parts.eyeR]
      : [bat];
    this.tweens.add({
      targets: targets,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 220,
      onComplete: function () {
        targets.forEach(function (t) { t.setVisible(false); });
      }
    });
  };

  GameScene.prototype.applyDeath = function () {
    if (!this.isDyingInLava) this.playSfx(this.deathSound, "death");
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
    var platformColor = this.biomeId === "desert" ? 0xc4a574 : 0x8b5cf6;
    // Rebuild static platform bodies from current platform data
    this.platformGroup.clear(true, true);
    this.platformSprites = [];
    for (var j = 0; j < this.platformsData.length; j++) {
      var p2 = this.platformsData[j];
      var rect2 = this.add.rectangle(p2.x + p2.w / 2, p2.y + p2.h / 2, p2.w, p2.h, platformColor);
      this.physics.add.existing(rect2, true);
      rect2.body.checkCollision.down = false;
      rect2.body.checkCollision.left = false;
      rect2.body.checkCollision.right = false;
      this.platformGroup.add(rect2);
      rect2.setData("platformIndex", j);
      rect2.setData("platformData", p2);
      this.platformSprites.push(rect2);
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
    this.doubleJumpUsedThisFlight = false;

    // Reset default biome enemies
    if (this.biomeId === "default") {
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
      slime.setData("baseY", baseY + slimeW / 2);
      slime.setData("state", "waiting");
      slime.setData("timer", (60 + Math.random() * 120) / REFERENCE_FPS);
      slime.setData("vy", 0);
      slime.setData("dead", false);
      slime.setVisible(true);
      slime.scaleX = 1;
      slime.scaleY = 1;
      slime.alpha = 1;
      slime.body.checkCollision.none = false;
    }
    // Reset slime eyes
    for (var se = 0; se < this.slimeEyes.length; se++) {
      var seInfo = this.slimeEyes[se];
      var sb = seInfo.body;
      seInfo.eye1.setVisible(!sb.getData("dead"));
      seInfo.eye2.setVisible(!sb.getData("dead"));
    }
    for (var bi = 0; bi < this.bats.length; bi++) {
      var bat = this.bats[bi];
      var bdef = this.batDefs[bi];
      bat.x = bdef.x + BAT_W / 2;
      bat.y = bdef.y + BAT_H / 2;
      bat.body.setVelocity(0, 0);
      bat.setVisible(true);
      bat.scaleX = 1;
      bat.scaleY = 1;
      bat.alpha = 1;
    }
    // Reset bat parts
    for (var bp = 0; bp < this.batParts.length; bp++) {
      var bInfo = this.batParts[bp];
      var bb = bInfo.body;
      bInfo.leftWing.setVisible(true);
      bInfo.rightWing.setVisible(true);
      bInfo.eyeL.setVisible(true);
      bInfo.eyeR.setVisible(true);
      bInfo.leftWing.x = bb.x - 10;
      bInfo.leftWing.y = bb.y;
      bInfo.rightWing.x = bb.x + 10;
      bInfo.rightWing.y = bb.y;
      bInfo.eyeL.x = bb.x - 3;
      bInfo.eyeL.y = bb.y - 3;
      bInfo.eyeR.x = bb.x + 3;
      bInfo.eyeR.y = bb.y - 3;
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
    // Reset crawler eyes
    for (var ce = 0; ce < this.crawlerEyes.length; ce++) {
      var cInfo = this.crawlerEyes[ce];
      var cb = cInfo.body;
      cInfo.eye1.setVisible(!cb.getData("dead"));
      cInfo.eye2.setVisible(!cb.getData("dead"));
      cInfo.eye1.x = cb.x - 3;
      cInfo.eye1.y = cb.y - 3;
      cInfo.eye2.x = cb.x + 3;
      cInfo.eye2.y = cb.y - 3;
    }
    } else if (this.biomeId === "desert") {
      // Reset scorpions to start positions
      for (var sci = 0; sci < this.scorpions.length; sci++) {
        var scorp = this.scorpions[sci];
        var sdef = this.scorpionDefs[sci];
        if (sdef) {
          scorp.x = sdef.startX;
          scorp.setData("direction", sdef.direction);
        }
        var splat = this.platformsData[sdef.platformIndex];
        if (splat) scorp.y = splat.y - SCORPION_H / 2;
        scorp.body.updateFromGameObject();
      }
      // Reset buzzards to initial positions
      for (var bzi = 0; bzi < this.buzzards.length; bzi++) {
        var buzz = this.buzzards[bzi];
        var bzdef = this.buzzardDefs[bzi];
        if (bzdef) {
          buzz.x = bzdef.x + BUZZARD_W / 2;
          buzz.y = bzdef.y + BUZZARD_H / 2;
        }
        buzz.body.setVelocity(0, 0);
        buzz.setData("vx", 0);
        buzz.setData("vy", 0);
        buzz.body.updateFromGameObject();
      }
      for (var bpi = 0; bpi < this.buzzardParts.length; bpi++) {
        var bzInfo = this.buzzardParts[bpi];
        bzInfo.wingL.x = bzInfo.body.x - 8;
        bzInfo.wingL.y = bzInfo.body.y + 2;
        bzInfo.wingR.x = bzInfo.body.x + 8;
        bzInfo.wingR.y = bzInfo.body.y + 2;
      }
      // Reset needle-shooter cacti state
      for (var cai = 0; cai < this.cactusHitboxes.length; cai++) {
        this.cactusHitboxes[cai].setData("shakeTimer", 0);
        this.cactusHitboxes[cai].setData("fired", false);
      }
      // Destroy all needles
      if (this.needleGroup) {
        this.needleGroup.clear(true, true);
      }
    }

    this.lavaBounceItemCollected = false;
    this.lavaBounceBounces = 0;
    this.lavaBounceTotalUses = 0;
    this.lavaBounceCooldownUntil = 0;
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
      for (var cvi = 0; cvi < this.checkpointVfx.length; cvi++) {
        var vfx = this.checkpointVfx[cvi];
        if (vfx && vfx.flag && vfx.pole) {
          vfx.flag.fillColor = 0x48bb78;
          vfx.pole.fillColor = 0x718096;
        }
      }
    }
    this.timerStarted = false;
    this.startTime = 0;
    this.currentTime = 0;
    this.gameWon = false;
    this.winSequenceState = "idle";
    this.winHoldTimer = 0;
    this.isDyingInLava = false;
    this.lavaDeathTimer = 0;
  };

  // 0 = too far to hear, 1 = at player; used for distance-based SFX volume
  GameScene.prototype.getProximityVolume = function (x, y) {
    var dx = this.player.x - x;
    var dy = this.player.y - y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d >= HEARING_MAX_DISTANCE) return 0;
    return 1 - d / HEARING_MAX_DISTANCE;
  };

  GameScene.prototype.showWinOverlay = function (fadeIn) {
    var el = document.getElementById("winOverlay");
    if (!el) return;
    if (fadeIn) {
      el.style.display = "flex";
      el.style.opacity = "0";
      el.style.transition = "opacity 0.5s ease";
      var scene = this;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.opacity = "1";
        });
      });
    } else {
      el.style.display = "flex";
      el.style.opacity = "1";
      el.style.transition = "";
    }
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
      } else {
        nextBtn.style.display = "none";
      }
    }
  };

  GameScene.prototype.update = function (time, delta) {
    this.sceneTime = (typeof time === "number") ? time : 0;
    var dt = delta / 1000;
    if (dt > 0.05) dt = 0.05;

    if (this.gameWon) {
      if (this.playerHead && this.playerHead.active) {
        var fx = this.player.facing;
        var sx = this.player.scaleX;
        var sy = this.player.scaleY;
        this.playerHead.x = this.player.x + fx * 15 * sx;
        this.playerHead.y = this.player.y;
        this.playerHead.scaleX = sx;
        this.playerHead.scaleY = sy;
        this.playerEye.x = this.player.x + fx * 8 * sx;
        this.playerEye.y = this.player.y - 5;
        this.playerEye.scaleX = sx;
        this.playerEye.scaleY = sy;
      }
      if (this.winSequenceState === "holding") {
        this.winHoldTimer -= dt;
        if (this.winHoldTimer <= 0) {
          this.winSequenceState = "done";
          this.showWinOverlay(true);
        }
      }
      return;
    }

    if (this.isDyingInLava) {
      this.lavaDeathTimer -= dt;
      // Slow sink into lava with fade-out
      this.player.y += 20 * dt;
      this.player.body.setVelocity(this.player.body.velocity.x * 0.9, 0);
      var tDeath = 1 - (this.lavaDeathTimer / LAVA_DEATH_DURATION);
      if (tDeath < 0) tDeath = 0;
      if (tDeath > 1) tDeath = 1;
      var alpha = 1 - tDeath;
      this.player.alpha = alpha;
      this.playerHead.alpha = alpha;
      this.playerEye.alpha = alpha;
      if (this.lavaDeathTimer <= 0) {
        this.playSfx(this.deathSound, "death");
        this.applyDeath();
        this.player.alpha = 1;
        this.playerHead.alpha = 1;
        this.playerEye.alpha = 1;
      }
      return;
    }

    var keys = window.__dragonKeys;
    if (!this.timerStarted && (keys.left || keys.right || keys.jump || keys.boost || keys.breath)) {
      this.timerStarted = true;
      this.startTime = time / 1000;
    }
    if (this.timerStarted) this.currentTime = (time / 1000) - this.startTime;

    var creatureSpeedMult = 1;
    if (this.currentDifficulty != null && typeof this.currentDifficulty === "number") {
      var diffT = (Math.max(1, Math.min(30, this.currentDifficulty)) - 1) / 29;
      creatureSpeedMult = 1 + 0.6 * diffT;
    }

    // Player movement - fixed hitbox: we only change velocity
    this.player.body.setVelocity(0, this.player.body.velocity.y);
    if (keys.left) {
      this.player.body.setVelocityX(-moveSpeed);
      this.player.facing = -1;
    }
    if (keys.right) {
      this.player.body.setVelocityX(moveSpeed);
      this.player.facing = 1;
    }
    // Change player color for buffs:
    // - lava orb: always blink while you have it (HUD shows bounces left)
    // - fire totem: orange tint
    // - both: orange + blink
    var dragonColor = 0x4a9b4a;
    var fireActive = (this.fireBreathsLeft > 0 || this.fireTotemCollected);
    var orbActive = this.lavaBounceItemCollected;
    var period = 0.6;
    var tSec = time / 1000;
    var phase = (tSec / period) % 1;
    var bright = phase < 0.5;
    if (fireActive && orbActive) {
      dragonColor = bright ? 0xffe2b3 : 0xff8c32;
    } else if (orbActive) {
      dragonColor = bright ? 0xfff3c4 : 0xf97316;
    } else if (fireActive) {
      dragonColor = 0xb85c20;
    }
    this.player.fillColor = dragonColor;
    this.playerHead.fillColor = dragonColor;
    this.playerEye.fillColor = 0xffffff;
    var fx = this.player.facing;
    this.playerHead.x = this.player.x + fx * 15;
    this.playerHead.y = this.player.y;
    this.playerEye.x = this.player.x + fx * 8;
    this.playerEye.y = this.player.y - 5;

    // Lenient "on a real platform" check so jump from the very edge counts as ground jump
    this.standingPlatformIndex = -1;
    var playerLeft = this.player.x - DRAGON_W / 2;
    var playerRight = this.player.x + DRAGON_W / 2;
    var playerBottom = this.player.y + DRAGON_H / 2;
    for (var pk = 0; pk < this.platformsData.length; pk++) {
      var plat = this.platformsData[pk];
      if (!plat || plat.dropping) continue;
      var platLeft = plat.x - GROUND_EDGE_TOLERANCE;
      var platRight = plat.x + (plat.w || 0) + GROUND_EDGE_TOLERANCE;
      var platTop = plat.y;
      var platBottom = plat.y + (plat.h || 16) + 2;
      if (playerRight >= platLeft && playerLeft <= platRight &&
          playerBottom >= platTop - GROUND_TOP_TOLERANCE && playerBottom <= platBottom) {
        this.standingPlatformIndex = pk;
        break;
      }
    }
    var physicsGround = this.player.body.blocked.down || this.player.body.touching.down;
    var onGround = physicsGround || this.standingPlatformIndex >= 0;
    if (onGround) {
      this.player.timeInAir = 0;
      // Landing on a real platform (physics contact) resets double jump for next flight
      if (physicsGround && this.standingPlatformIndex >= 0) this.doubleJumpUsedThisFlight = false;
      // Landing on a platform resets the per-run lava bounce counter
      this.lavaBounceBounces = 0;
    } else {
      this.player.timeInAir += dt;
    }

    if (keys.jump && onGround) {
      this.player.body.setVelocityY(-jumpStrength);
      this.player.jumpsLeft = 1;
      window.__dragonJumpKeyReleased = false;
      this.playSfx(this.jumpSound, "jump");
    } else if (keys.jump && !onGround && !this.doubleJumpUsedThisFlight && window.__dragonJumpKeyReleased) {
      this.player.body.setVelocityY(-jumpStrength);
      this.doubleJumpUsedThisFlight = true;
      this.player.jumpsLeft = 0;
      window.__dragonJumpKeyReleased = false;
      this.playSfx(this.jumpSound, "jump");
      this.spawnDoubleJumpPlatform();
    }

    var djPlat = this.doubleJumpPlatform;
    if (djPlat && djPlat.scene && !djPlat.getData("used")) {
      var overlap = this.physics.overlap(this.player, djPlat);
      var playerBottom = this.player.y + DRAGON_H / 2;
      var platTop = djPlat.y - DOUBLE_JUMP_PLAT_H / 2;
      var onPlat = overlap && playerBottom >= platTop - 2 && playerBottom <= platTop + 8;
      if (onPlat) {
        this.wasOnDoubleJumpPlat = true;
      } else {
        if (this.wasOnDoubleJumpPlat) {
          djPlat.setData("used", true);
          djPlat.body.checkCollision.none = true;
        }
        this.wasOnDoubleJumpPlat = false;
      }
    } else {
      this.wasOnDoubleJumpPlat = false;
    }

    if (keys.boost && !onGround && this.player.boostAvailable && this.player.timeInAir >= BOOST_AIR_DELAY_SEC) {
      this.player.boostAvailable = false;
      this.player.boostFramesLeft = BOOST_DURATION_SEC;
      this.playSfx(this.boostSound, "boost");
    }
    if (this.player.boostFramesLeft > 0) {
      this.player.body.setVelocityX(this.player.body.velocity.x + this.player.facing * BOOST_POWER_H * dt);
      this.player.boostFramesLeft -= dt;
    }

    if (keys.breath && !window.__dragonBreathKeyConsumed && this.fireBreathsLeft > 0 && this.breathActiveTime <= 0) {
      window.__dragonBreathKeyConsumed = true;
      this.breathActiveTime = 10 / REFERENCE_FPS;
      this.playSfx(this.breathSound, "breath");
    }

    // Fire breath overlap vs slimes/crawlers
    if (this.breathActiveTime > 0) {
      var breathX = this.player.x + (this.player.facing > 0 ? 1 : -1) * (DRAGON_W / 2 + DRAGON_MOUTH_OVERHANG + BREATH_LEN / 2);
      var breathW = BREATH_LEN;
      // Raise the flame so it comes out near the dragon's head instead of the feet.
      var breathY = this.player.y - DRAGON_H * 0.3;
      var breathH = DRAGON_H - 8;
      // Visual flame
      this.breathSprite.setVisible(true);
      this.breathSprite.width = breathW;
      this.breathSprite.height = breathH;
      this.breathSprite.x = breathX;
      this.breathSprite.y = breathY + breathH / 2;
      for (var si = 0; si < this.slimes.length; si++) {
        var s = this.slimes[si];
        if (s.getData("dead")) continue;
        if (breathX - breathW / 2 < s.x + 11 && breathX + breathW / 2 > s.x - 11 &&
            breathY < s.y + 9 && breathY + breathH > s.y - 9) {
          this.killSlime(s);
        }
      }
      for (var cj = 0; cj < this.crawlers.length; cj++) {
        var c = this.crawlers[cj];
        if (c.getData("dead")) continue;
        if (breathX - breathW / 2 < c.x + CRAWLER_W / 2 && breathX + breathW / 2 > c.x - CRAWLER_W / 2 &&
            breathY < c.y + CRAWLER_H / 2 && breathY + breathH > c.y - CRAWLER_H / 2) {
          this.killCrawler(c);
        }
      }
      // Bats can also be burned by flame
      for (var bb = 0; bb < this.bats.length; bb++) {
        var bat = this.bats[bb];
        if (!bat.visible) continue;
        if (breathX - breathW / 2 < bat.x + BAT_W / 2 && breathX + breathW / 2 > bat.x - BAT_W / 2 &&
            breathY < bat.y + BAT_H / 2 && breathY + breathH > bat.y - BAT_H / 2) {
          this.killBat(bat);
        }
      }
      this.breathActiveTime -= dt;
    } else {
      this.breathSprite.setVisible(false);
    }

    // Slimes update (default biome only)
    if (this.biomeId === "default") {
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
          slime.setData("vy", -SLIME_JUMP_STRENGTH * creatureSpeedMult);
          var pv = this.getProximityVolume(slime.x, slime.y);
          if (pv > 0.06) this.playSfx(this.slimeSound, "slimeJump", { volume: 0.5 * pv });
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
    // Keep slime eyes attached
    for (var se = 0; se < this.slimeEyes.length; se++) {
      var seInfo = this.slimeEyes[se];
      var sb = seInfo.body;
      if (sb.getData("dead")) {
        seInfo.eye1.setVisible(false);
        seInfo.eye2.setVisible(false);
        continue;
      }
      seInfo.eye1.x = sb.x - 4;
      seInfo.eye1.y = sb.y - 3;
      seInfo.eye2.x = sb.x + 4;
      seInfo.eye2.y = sb.y - 3;
    }

    // Bats update (wander erratically, gently attracted to player)
    var xMin = 50 + BAT_W / 2, xMax = LEVEL_LENGTH - 50 - BAT_W / 2;
    var yMin = 80 + BAT_H / 2, yMax = this.WORLD_H - 80 - BAT_H / 2;
    for (var bi = 0; bi < this.bats.length; bi++) {
      var bat = this.bats[bi];
      var rng = bat.getData("rng");
      var vx = bat.getData("vx") || 0;
      var vy = bat.getData("vy") || 0;
      // Random wander
      vx += (rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
      vy += (rng() - 0.5) * BAT_WANDER_STRENGTH * 2 * dt;
      // Gentle attraction to player when nearby
      var dx = this.player.x - bat.x;
      var dy = this.player.y - bat.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 220 && dist > 1) {
        var attract = (220 - dist) / 220; // stronger when closer
        vx += (dx / dist) * BAT_WANDER_STRENGTH * attract * dt;
        vy += (dy / dist) * BAT_WANDER_STRENGTH * attract * dt;
      }
      var speed = Math.sqrt(vx * vx + vy * vy);
      var batMax = BAT_MAX_SPEED * creatureSpeedMult;
      if (speed > batMax) {
        vx = (vx / speed) * batMax;
        vy = (vy / speed) * batMax;
      }
      bat.setData("vx", vx);
      bat.setData("vy", vy);
      bat.x = Phaser.Math.Clamp(bat.x + vx * dt, xMin, xMax);
      bat.y = Phaser.Math.Clamp(bat.y + vy * dt, yMin, yMax);
      bat.body.updateFromGameObject();
      // Occasional bat chitter (rate scales with dt); volume by proximity
      if (rng() < 0.4 * dt) {
        var pv = this.getProximityVolume(bat.x, bat.y);
        if (pv > 0.06) this.playSfx(this.batSound, "batChitter", { volume: 0.4 * pv });
      }
    }
    // Keep bat parts attached
    for (var bp = 0; bp < this.batParts.length; bp++) {
      var bInfo = this.batParts[bp];
      var bb = bInfo.body;
      bInfo.leftWing.x = bb.x - 10;
      bInfo.leftWing.y = bb.y;
      bInfo.rightWing.x = bb.x + 10;
      bInfo.rightWing.y = bb.y;
      bInfo.eyeL.x = bb.x - 3;
      bInfo.eyeL.y = bb.y - 3;
      bInfo.eyeR.x = bb.x + 3;
      bInfo.eyeR.y = bb.y - 3;
    }

    // Crawlers update
    for (var ck = 0; ck < this.crawlers.length; ck++) {
      var crawler = this.crawlers[ck];
      if (crawler.getData("dead")) continue;
      var cplat = this.platformsData[crawler.getData("platformIndex")];
      if (!cplat) continue;
      var oldOffset = crawler.getData("offset");
      var wasTop = oldOffset >= 0 && oldOffset < 0.25;
      var wasBottom = oldOffset >= 0.5 && oldOffset < 0.75;
      var offset = oldOffset + CRAWLER_PERIMETER_SPEED * creatureSpeedMult * dt;
      if (offset >= 1) offset -= 1;
      crawler.setData("offset", offset);
      var pos = crawlerPerimeterPosition(cplat, offset);
      crawler.x = pos.cx;
      crawler.y = pos.cy;
      var isTop = offset >= 0 && offset < 0.25;
      var isBottom = offset >= 0.5 && offset < 0.75;
      if ((!wasTop && isTop) || (!wasBottom && isBottom)) {
        var pv = this.getProximityVolume(crawler.x, crawler.y);
        if (pv > 0.06) this.playSfx(this.crawlerSound, "crawlerSlide", { volume: 0.7 * pv });
      }
    }
    // Keep crawler eyes attached
    for (var ce = 0; ce < this.crawlerEyes.length; ce++) {
      var cInfo = this.crawlerEyes[ce];
      var cb = cInfo.body;
      if (cb.getData("dead")) {
        cInfo.eye1.setVisible(false);
        cInfo.eye2.setVisible(false);
        continue;
      }
      cInfo.eye1.x = cb.x - 3;
      cInfo.eye1.y = cb.y - 3;
      cInfo.eye2.x = cb.x + 3;
      cInfo.eye2.y = cb.y - 3;
    }
    } else if (this.biomeId === "desert") {
      // Scorpions: patrol back and forth
      for (var sci = 0; sci < this.scorpions.length; sci++) {
        var scorp = this.scorpions[sci];
        var left = scorp.getData("left");
        var right = scorp.getData("right");
        var dir = scorp.getData("direction");
        scorp.x += dir * SCORPION_SPEED * creatureSpeedMult * dt;
        if (scorp.x <= left) { scorp.x = left; scorp.setData("direction", 1); }
        if (scorp.x >= right) { scorp.x = right; scorp.setData("direction", -1); }
        scorp.body.updateFromGameObject();
      }
      // Buzzards: wander like bats
      var buzzXMin = 50 + BUZZARD_W / 2, buzzXMax = LEVEL_LENGTH - 50 - BUZZARD_W / 2;
      var buzzYMin = 80 + BUZZARD_H / 2, buzzYMax = this.WORLD_H - 80 - BUZZARD_H / 2;
      for (var bzi = 0; bzi < this.buzzards.length; bzi++) {
        var buzz = this.buzzards[bzi];
        var rng = buzz.getData("rng");
        var vx = buzz.getData("vx") || 0;
        var vy = buzz.getData("vy") || 0;
        vx += (rng() - 0.5) * BUZZARD_WANDER_STRENGTH * 2 * dt;
        vy += (rng() - 0.5) * BUZZARD_WANDER_STRENGTH * 2 * dt;
        var speed = Math.sqrt(vx * vx + vy * vy);
        var buzzMax = BUZZARD_MAX_SPEED * creatureSpeedMult;
        if (speed > buzzMax) {
          vx = (vx / speed) * buzzMax;
          vy = (vy / speed) * buzzMax;
        }
        buzz.setData("vx", vx);
        buzz.setData("vy", vy);
        buzz.x = Phaser.Math.Clamp(buzz.x + vx * dt, buzzXMin, buzzXMax);
        buzz.y = Phaser.Math.Clamp(buzz.y + vy * dt, buzzYMin, buzzYMax);
        buzz.body.updateFromGameObject();
      }
      for (var bpi = 0; bpi < this.buzzardParts.length; bpi++) {
        var bzInfo = this.buzzardParts[bpi];
        bzInfo.wingL.x = bzInfo.body.x - 8;
        bzInfo.wingL.y = bzInfo.body.y + 2;
        bzInfo.wingR.x = bzInfo.body.x + 8;
        bzInfo.wingR.y = bzInfo.body.y + 2;
      }
      // Needle-shooter cacti (variety 2): when player close, shake then fire 4 needles
      for (var cai = 0; cai < this.cactusHitboxes.length; cai++) {
        var ch = this.cactusHitboxes[cai];
        if (ch.getData("variety") !== 2 || ch.getData("fired")) continue;
        var dx = this.player.x - ch.x;
        var dy = this.player.y - ch.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > CACTUS_NEEDLE_TRIGGER_DIST) continue;
        var shakeTimer = ch.getData("shakeTimer");
        if (shakeTimer <= 0) ch.setData("shakeTimer", CACTUS_SHAKE_DURATION);
        shakeTimer = ch.getData("shakeTimer") - dt;
        ch.setData("shakeTimer", shakeTimer);
        if (shakeTimer <= 0) {
          ch.setData("fired", true);
          var numNeedles = CACTUS_NEEDLE_COUNT;
          for (var ni = 0; ni < numNeedles; ni++) {
            var angle = (ni / numNeedles) * Math.PI * 2 + (cai * 0.5);
            var vx = Math.cos(angle) * NEEDLE_SPEED;
            var vy = Math.sin(angle) * NEEDLE_SPEED;
            var needle = this.add.rectangle(ch.x, ch.y, NEEDLE_R * 2, NEEDLE_R * 2, 0x1a3a17);
            this.physics.add.existing(needle, false);
            needle.body.setVelocity(vx, vy);
            needle.body.setAllowGravity(false);
            needle.setData("birthTime", time / 1000);
            this.needleGroup.add(needle);
          }
        }
      }
      // Needles: remove when off screen or too old
      var needleChildren = this.needleGroup.getChildren();
      for (var ni = needleChildren.length - 1; ni >= 0; ni--) {
        var n = needleChildren[ni];
        if (!n.active) continue;
        var age = (time / 1000) - (n.getData("birthTime") || 0);
        if (age > 3 || n.x < -50 || n.x > LEVEL_LENGTH + 50 || n.y < this.worldMinY - 50 || n.y > this.worldMaxY + 50) {
          n.destroy();
        }
      }
    }

    // Animate item VFX (orb pulse, flame wobble), hide when collected
    if (this.itemVfx && this.itemVfx.length) {
      var t = time / 1000;
      for (var iv = 0; iv < this.itemVfx.length; iv++) {
        var v = this.itemVfx[iv];
        var zone = v.zone;
        var collected = zone.getData("collected");
        if (v.type === "lavaBounce") {
          if (collected) {
            v.sprite.setVisible(false);
            continue;
          }
          var pulse = 0.9 + 0.15 * Math.sin(t * 3);
          v.sprite.setVisible(true);
          v.sprite.setScale(pulse);
        } else if (v.type === "fireTotem") {
          var base = v.base, mid = v.mid, flame = v.flame;
          if (collected) {
            base.setVisible(false);
            mid.setVisible(false);
            flame.setVisible(false);
            continue;
          }
          base.setVisible(true);
          mid.setVisible(true);
          flame.setVisible(true);
          var wobble = 0.9 + 0.12 * Math.sin(t * 4);
          flame.setScale(1, wobble);
        }
      }
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
        var platCx = p.x + p.w / 2;
        var platCy = p.y + p.h / 2;
        var pv = this.getProximityVolume(platCx, platCy);
        if (!p.dropActive) {
          p.dropActive = true;
          if (pv > 0.06) this.playSfx(this.platformStepSound, "platformStep", { volume: 0.6 * pv });
        }
        if (p.dropTimer > 0) {
          p.dropTimer -= dt;
          if (p.dropTimer <= 0) {
            p.dropping = true;
            if (pv > 0.06) this.playSfx(this.platformFallSound, "platformFall", { volume: 0.6 * pv });
          }
        }
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

    // standingPlatformIndex already set above (lenient check for drop-platform logic)

    if (onGround) {
      this.player.onGround = true;
      if (physicsGround && this.standingPlatformIndex >= 0) {
        this.player.jumpsLeft = 2;   // next ground jump + one double jump available
        this.player.boostAvailable = true;
      }
    } else {
      this.player.onGround = false;
    }

    // Simple motion trail behind the dragon (uses same dragonColor so orb/totem = orange trail)
    if (!this.trailGraphics) {
      this.trailGraphics = this.add.graphics().setDepth(this.player.depth - 1);
      this.trail = [];
    }
    var speedMag = Math.sqrt(this.player.body.velocity.x * this.player.body.velocity.x + this.player.body.velocity.y * this.player.body.velocity.y);
    if (speedMag > 45 || this.player.boostFramesLeft > 0) {
      this.trail.push({ x: this.player.x, y: this.player.y });
      if (this.trail.length > 16) this.trail.shift();
    } else {
      this.trail.length = 0;
    }
    this.trailGraphics.clear();
    for (var ti = 0; ti < this.trail.length; ti++) {
      var tInfo = this.trail[ti];
      var alpha = 0.1 + (ti / Math.max(1, this.trail.length)) * 0.4;
      this.trailGraphics.fillStyle(dragonColor, alpha);
      this.trailGraphics.fillRect(tInfo.x - DRAGON_W / 2, tInfo.y - DRAGON_H / 2, DRAGON_W, DRAGON_H);
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

  function getPlayedLevelsSummary() {
    var profile = loadProfile();
    var runs = (profile && Array.isArray(profile.runs)) ? profile.runs : [];
    var map = Object.create(null);
    runs.forEach(function (r) {
      if (!r) return;
      if (r.seed == null || r.difficulty == null) return;
      var seed = r.seed | 0;
      var diff = r.difficulty | 0;
      if (!seed || seed <= 0) return;
      if (!diff || diff < 1 || diff > 30) return;
      var key = seed + "/" + diff;
      var time = (typeof r.timeSeconds === "number" && isFinite(r.timeSeconds)) ? r.timeSeconds : Infinity;
      var dots = (typeof r.dotsCollected === "number") ? r.dotsCollected : 0;
      var dotsTotal = (typeof r.dotsTotal === "number") ? r.dotsTotal : NUM_DOTS;
      var ts = Date.parse(r.timestamp || "") || 0;
      var existing = map[key];
      if (!existing) {
        map[key] = {
          key: key,
          seed: seed,
          difficulty: diff,
          bestTime: time,
          bestDots: dots,
          dotsTotal: dotsTotal,
          lastPlayed: ts
        };
      } else {
        if (time < existing.bestTime) existing.bestTime = time;
        if (dots > existing.bestDots) {
          existing.bestDots = dots;
          existing.dotsTotal = dotsTotal;
        }
        if (ts > existing.lastPlayed) existing.lastPlayed = ts;
      }
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) {
      return (b.lastPlayed || 0) - (a.lastPlayed || 0);
    });
    return list;
  }

  function populatePlayedDropdown() {
    var select = document.getElementById("playedSelect");
    if (!select) return;
    var summary = getPlayedLevelsSummary();
    select.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = summary.length ? "Played levels…" : "No played levels yet";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    summary.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.seed + "/" + p.difficulty;
      var best = (typeof p.bestTime === "number" && isFinite(p.bestTime) && p.bestTime < Infinity)
        ? p.bestTime.toFixed(2) + "s"
        : "--";
      var dotsText = p.bestDots > 0 ? (p.bestDots + "/" + (p.dotsTotal || NUM_DOTS)) : "--";
      opt.textContent = p.seed + "/" + p.difficulty + " (Best: " + best + ", Dots: " + dotsText + ")";
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
    var hashBiome = (parts.length > 2 && (parts[2] === "desert" || parts[2] === "default")) ? parts[2] : getSelectedBiomeId();
    if (hashBiome && document.getElementById("biomeSelect")) document.getElementById("biomeSelect").value = hashBiome;
    setSelectedBiomeId(hashBiome);
    window.__dragonLevelData = buildLevelDataForNewSeed(hashSeed, difficulty, hashBiome);
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
    populatePlayedDropdown();
    window.__dragonPopulateLevelDropdown = populateLevelDropdown;
    window.__dragonPopulatePlayedDropdown = populatePlayedDropdown;

    // Biome selector: default (Cave) and desert
    var biomeSelect = document.getElementById("biomeSelect");
    if (biomeSelect) {
      biomeSelect.innerHTML = "";
      var optDefault = document.createElement("option");
      optDefault.value = "default";
      optDefault.textContent = "Cave";
      biomeSelect.appendChild(optDefault);
      var optDesert = document.createElement("option");
      optDesert.value = "desert";
      optDesert.textContent = "Desert";
      biomeSelect.appendChild(optDesert);
      biomeSelect.value = getSelectedBiomeId();
      biomeSelect.addEventListener("change", function () {
        setSelectedBiomeId(biomeSelect.value);
      });
    }

    // Difficulty dropdown (random or 1-30), persisted in localStorage
    var diffSelect = document.getElementById("difficultySelect");
    if (diffSelect) {
      diffSelect.innerHTML = "";
      var optRandom = document.createElement("option");
      optRandom.value = "random";
      optRandom.textContent = "Difficulty: random";
      diffSelect.appendChild(optRandom);
      for (var d = 1; d <= 30; d++) {
        var optD = document.createElement("option");
        optD.value = String(d);
        optD.textContent = "Difficulty: " + d;
        diffSelect.appendChild(optD);
      }
      var stored = loadDifficultySetting();
      diffSelect.value = stored;
      diffSelect.addEventListener("change", function () {
        saveDifficultySetting(diffSelect.value);
      });
    }

    // Mock sign-in: username stored in localStorage profile
    var userForm = document.getElementById("userForm");
    var usernameInput = document.getElementById("usernameInput");
    var saveUserBtn = document.getElementById("saveUserBtn");
    function renderUserForm(username) {
      if (!userForm) return;
      username = username || "";
      if (username) {
        userForm.innerHTML =
          '<span class="user-name-pill">' + username.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span> ' +
          '<button id="logoutBtn" type="button" title="Logout (clear player name)">Logout</button>';
        var logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
          logoutBtn.addEventListener("click", function () {
            setProfileUsername("");
            // Restore input UI
            userForm.innerHTML =
              '<input id="usernameInput" type="text" placeholder="Your name" title="Your player name">' +
              '<button id="saveUserBtn" type="button" title="Save player name">Save</button>';
            var newInput = document.getElementById("usernameInput");
            var newSaveBtn = document.getElementById("saveUserBtn");
            if (newSaveBtn && newInput) {
              newSaveBtn.addEventListener("click", function () {
                var name = newInput.value.trim();
                setProfileUsername(name);
                renderUserForm(name);
              });
            }
          });
        }
      } else {
        // Ensure input mode if no username
        userForm.innerHTML =
          '<input id="usernameInput" type="text" placeholder="Your name" title="Your player name">' +
          '<button id="saveUserBtn" type="button" title="Save player name">Save</button>';
        var inputEl = document.getElementById("usernameInput");
        var saveBtnEl = document.getElementById("saveUserBtn");
        if (inputEl) inputEl.value = getProfileUsername();
        if (saveBtnEl && inputEl) {
          saveBtnEl.addEventListener("click", function () {
            var name = inputEl.value.trim();
            setProfileUsername(name);
            renderUserForm(name);
          });
        }
      }
    }
    // Initial render based on stored username
    renderUserForm(getProfileUsername());

    // Audio controls: separate SFX and music toggles
    var muteSfxBtn = document.getElementById("muteSfxBtn");
    var muteMusicBtn = document.getElementById("muteMusicBtn");
    if (muteSfxBtn) {
      function updateSfxLabel() {
        muteSfxBtn.textContent = isSfxEnabled() ? "\u{1F50A} FX" : "\u{1F507} FX";
      }
      updateSfxLabel();
      muteSfxBtn.addEventListener("click", function () {
        var enabled = !isSfxEnabled();
        setSfxEnabled(enabled);
        updateSfxLabel();
      });
    }
    if (muteMusicBtn) {
      function updateMusicLabel() {
        muteMusicBtn.textContent = isMusicEnabled() ? "\u{1F50A}\u266A" : "\u{1F507}\u266A";
      }
      updateMusicLabel();
      muteMusicBtn.addEventListener("click", function () {
        var enabled = !isMusicEnabled();
        setMusicEnabled(enabled);
        updateMusicLabel();
        var game = window.__dragonGame;
        if (game && game.scene) {
          var scene = game.scene.getScene("Game");
          if (scene && scene.music) {
            if (enabled) {
              if (!scene.music.isPlaying) scene.music.play();
              scene.music.setMute(false);
            } else {
              scene.music.setMute(true);
            }
          }
        }
      });
    }

    // Mobile audio unlock: resume Web Audio on first user interaction
    window.addEventListener("pointerdown", function unlockAudio() {
      var game = window.__dragonGame;
      if (game && game.sound && game.sound.context && game.sound.context.state === "suspended") {
        try { game.sound.context.resume(); } catch (e) {}
      }
      // Phaser also exposes an explicit unlock helper on some backends
      if (game && game.sound && typeof game.sound.unlock === "function") {
        try { game.sound.unlock(); } catch (e2) {}
      }
      window.removeEventListener("pointerdown", unlockAudio);
    });

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
      // Prevent Space and arrow keys from triggering focused buttons/scroll
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight") {
        if (e.preventDefault) e.preventDefault();
      }
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

    // On-screen buttons (mobile-friendly, stable press/hold)
    function bindBtn(id, keyName) {
      var btn = document.getElementById(id);
      if (!btn) return;
      var activePointerId = null;

      btn.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        activePointerId = e.pointerId;
        window.__dragonKeys[keyName] = true;
        if (btn.setPointerCapture) {
          try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        }
      });

      function clearForPointer(e) {
        if (activePointerId !== null && e.pointerId !== activePointerId) return;
        e.preventDefault();
        window.__dragonKeys[keyName] = false;
        activePointerId = null;
        if (btn.releasePointerCapture) {
          try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      }

      btn.addEventListener("pointerup", clearForPointer);
      btn.addEventListener("pointercancel", clearForPointer);
      // We intentionally do NOT clear on pointerleave so minor thumb drift
      // doesn't stop movement; release happens only on up/cancel.
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
        // Pure random level: use original generator, clear hash.
        window.__dragonLevelData = buildLevelDataForRandom();
        location.hash = "";
      } else {
        var level = data.levels.find(function (l) { return l.id === value; });
        if (level) {
          window.__dragonLevelData = buildLevelDataFromStored(level);
          var ld = window.__dragonLevelData;
          if (ld && ld.currentLevelSeed && ld.currentLevelSeed > 0) {
            var d = (ld.currentDifficulty != null) ? Math.max(1, Math.min(30, Math.floor(ld.currentDifficulty))) : null;
            var b = (ld.biomeId === "desert") ? "/desert" : "";
            location.hash = ld.currentLevelSeed + (d != null ? "/" + d : "") + b;
          } else {
            location.hash = "";
          }
        }
      }
      var overlay = document.getElementById("winOverlay");
      if (overlay) overlay.style.display = "none";
      startOrRestartGame();
    });

    var playedSelect = document.getElementById("playedSelect");
    if (playedSelect) {
      playedSelect.addEventListener("change", function (e) {
        var v = e.target.value || "";
        if (!v) return;
        var parts = v.split("/");
        var seed = parseInt(parts[0], 10);
        var diff = parts.length > 1 ? parseInt(parts[1], 10) : 15;
        if (!seed || seed <= 0 || isNaN(diff)) return;
        if (diff < 1 || diff > 30) diff = 15;
        window.__dragonLevelData = buildLevelDataForNewSeed(seed, diff);
        location.hash = seed + "/" + diff + (getSelectedBiomeId() === "desert" ? "/desert" : "");
        var overlay = document.getElementById("winOverlay");
        if (overlay) overlay.style.display = "none";
        startOrRestartGame();
      });
    }

    document.getElementById("newLevelBtn").addEventListener("click", function () {
      // New level: seed is random; difficulty comes from dropdown ("random" uses original generator).
      var diffVal = getSelectedDifficultyValue();
      if (diffVal === "random") {
        window.__dragonLevelData = buildLevelDataForRandom();
        location.hash = "";
      } else {
        var diff = Math.max(1, Math.min(30, parseInt(diffVal, 10) || 1));
        var seed = Math.floor(Math.random() * 1000000000) + 1;
        window.__dragonLevelData = buildLevelDataForNewSeed(seed, diff);
        location.hash = seed + "/" + diff + (getSelectedBiomeId() === "desert" ? "/desert" : "");
      }
      var overlay = document.getElementById("winOverlay");
      if (overlay) overlay.style.display = "none";
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
      var biomeId = (data && data.biomeId) || "default";
      var url = location.origin + location.pathname + "#" + seed + (difficulty != null ? "/" + difficulty : "") + (biomeId === "desert" ? "/desert" : "");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          var btn = document.getElementById("shareBtn");
          btn.classList.add("share-copied");
          setTimeout(function () { btn.classList.remove("share-copied"); }, 600);
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
      var ld = window.__dragonLevelData;
      if (ld && ld.currentLevelSeed && ld.currentLevelSeed > 0) {
        var d = (ld.currentDifficulty != null) ? Math.max(1, Math.min(30, Math.floor(ld.currentDifficulty))) : null;
        var b = (ld.biomeId === "desert") ? "/desert" : "";
        location.hash = ld.currentLevelSeed + (d != null ? "/" + d : "") + b;
      } else {
        location.hash = "";
      }
      document.getElementById("winOverlay").style.display = "none";
      startOrRestartGame();
    });

    var winNewLevelBtn = document.getElementById("winNewLevelBtn");
    if (winNewLevelBtn) {
      winNewLevelBtn.addEventListener("click", function () {
        var diffVal = getSelectedDifficultyValue();
        if (diffVal === "random") {
          window.__dragonLevelData = buildLevelDataForRandom();
          location.hash = "";
        } else {
          var diff = Math.max(1, Math.min(30, parseInt(diffVal, 10) || 1));
          var seed = Math.floor(Math.random() * 1000000000) + 1;
          window.__dragonLevelData = buildLevelDataForNewSeed(seed, diff);
          location.hash = seed + "/" + diff + (getSelectedBiomeId() === "desert" ? "/desert" : "");
        }
        document.getElementById("winOverlay").style.display = "none";
        startOrRestartGame();
      });
    }

    var winCloseBtn = document.getElementById("winCloseBtn");
    if (winCloseBtn) {
      winCloseBtn.addEventListener("click", function () {
        var diffVal = getSelectedDifficultyValue();
        if (diffVal === "random") {
          window.__dragonLevelData = buildLevelDataForRandom();
          location.hash = "";
        } else {
          var diff = Math.max(1, Math.min(30, parseInt(diffVal, 10) || 1));
          var seed = Math.floor(Math.random() * 1000000000) + 1;
          window.__dragonLevelData = buildLevelDataForNewSeed(seed, diff);
          location.hash = seed + "/" + diff + (getSelectedBiomeId() === "desert" ? "/desert" : "");
        }
        document.getElementById("winOverlay").style.display = "none";
        startOrRestartGame();
      });
    }

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
