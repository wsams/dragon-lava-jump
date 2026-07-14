/**
 * Level storage (localStorage) and default level pack.
 */
import { NUM_DOTS } from "./constants.js";
import {
  generateDefaultLevelLayout,
  generateCeilingAndStalactites,
  generateSlimesForPlatforms,
  generateBats,
  generateLavaBounceItem,
  generateFireTotemItem,
  generateDots,
  generateCheckpoints,
  generateCrawlers
} from "./levelGen.js";
import { makeRng } from "./rng.js";

export const LEVELS_STORAGE_KEY = "dragonLevels";

export const DEFAULT_LEVELS = [
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
  let changed = false;

  DEFAULT_LEVELS.forEach(meta => {
    let lvl = data.levels.find(l => l.id === meta.id);
    if (!lvl) {
      const layout = generateDefaultLevelLayout(meta.difficulty, meta.seed, H);
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
      if (typeof lvl.bestScore !== "number" || !isFinite(lvl.bestScore)) {
        lvl.bestScore = Infinity;
        changed = true;
      }
      if (typeof lvl.bestDots !== "number" || lvl.bestDots < 0) {
        lvl.bestDots = 0;
        changed = true;
      }
      if (lvl.difficulty == null) {
        lvl.difficulty = meta.difficulty;
        changed = true;
      }
      if (!Array.isArray(lvl.slimes)) {
        lvl.slimes = generateSlimesForPlatforms(lvl.platforms, lvl.difficulty || meta.difficulty, meta.seed + 999);
        changed = true;
      }
      if (!Array.isArray(lvl.ceiling) || !Array.isArray(lvl.stalactites)) {
        const cave = generateCeilingAndStalactites(lvl.difficulty || meta.difficulty, meta.seed + 321, lvl.platforms);
        lvl.ceiling = cave.ceilingPoints;
        lvl.stalactites = cave.stalactites;
        changed = true;
      }
      if (!Array.isArray(lvl.bats)) {
        lvl.bats = generateBats(lvl.difficulty || meta.difficulty, meta.seed + 777, H);
        changed = true;
      }
      if (!Array.isArray(lvl.items)) lvl.items = [];
      if (!lvl.items.some(i => i && i.type === "lavaBounce")) {
        lvl.items = lvl.items.concat(generateLavaBounceItem(meta.seed + 888, H));
        changed = true;
      }
      if (!lvl.items.some(i => i && i.type === "fireTotem")) {
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
      const anyBent = Array.isArray(lvl.platforms) && lvl.platforms.some(p => p && p.bend);
      if (Array.isArray(lvl.platforms) && !anyBent) {
        const d = lvl.difficulty || meta.difficulty;
        const dClamped = Math.max(1, Math.min(30, d));
        const t = (dClamped - 1) / 29;
        const bendChance = 0.1 + 0.6 * t;
        const rng = makeRng(meta.seed + 555);
        lvl.platforms.forEach((p, index) => {
          if (!p || index === 0 || p.bend) return;
          if (rng() >= bendChance) return;
          const joint = 0.25 + rng() * 0.5;
          const sign = rng() < 0.5 ? -1 : 1;
          const maxBendPixels = 14;
          const bendHeight = sign * (6 + rng() * (maxBendPixels - 6));
          p.bend = { joint, bendHeight };
        });
        changed = true;
      }
    }
  });

  if (changed) saveAllLevels(data);
  return data;
}

export function loadAllLevels(H) {
  let data;
  try {
    const raw = localStorage.getItem(LEVELS_STORAGE_KEY);
    data = !raw ? { levels: [] } : JSON.parse(raw);
    if (!data || !Array.isArray(data.levels)) data = { levels: [] };
  } catch {
    data = { levels: [] };
  }
  return ensureDefaultLevelsSeeded(data, H);
}

export function saveAllLevels(data) {
  localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(data));
}

export function saveCompletedLevel(levelID, name, platforms, goal, bestScore, dotsCollected, levelState, onSaved) {
  const data = loadAllLevels(levelState.H);
  const existing = data.levels.find(l => l.id === levelID);
  const dots = typeof dotsCollected === "number" ? dotsCollected : 0;

  if (existing) {
    if (typeof existing.bestScore !== "number" || !isFinite(existing.bestScore)) existing.bestScore = Infinity;
    if (bestScore < existing.bestScore) {
      existing.bestScore = bestScore;
      saveAllLevels(data);
    }
    if (dots > (existing.bestDots ?? 0)) {
      existing.bestDots = dots;
      saveAllLevels(data);
    }
    return;
  }

  const dotDefs = levelState.dotDefs.length === NUM_DOTS
    ? levelState.dotDefs
    : generateDots(platforms, (levelState.currentLevelSeed || 0) + 444, goal, levelState.slimeDefs, levelState.crawlerDefs);

  data.levels.push({
    id: levelID,
    name,
    platforms,
    goal,
    bestScore,
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
