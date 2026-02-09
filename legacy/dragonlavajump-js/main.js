/**
 * Entry point: init canvas/state, bind input, level UI, hash routing, game loop.
 */
import { state } from "./state.js";
import { REFERENCE_FPS, DT_CAP, LEVEL_LENGTH } from "./constants.js";
import { loadAllLevels } from "./storage.js";
import { NUM_DOTS } from "./constants.js";
import { bindInput } from "./input.js";
import { generateRandomLevel, generateLevelFromSeed, loadLevel, resetPlayerToStart } from "./gameFlow.js";
import { initLava } from "./state.js";
import { update } from "./update.js";
import { drawAll, updateWinOverlay } from "./draw.js";
import { LIVES_START } from "./constants.js";

function populateLevelDropdown() {
  const select = document.getElementById("levelSelect");
  const data = loadAllLevels(state.H);
  select.innerHTML = "";
  const optNew = document.createElement("option");
  optNew.value = "new";
  optNew.textContent = "New Random Level";
  select.appendChild(optNew);
  data.levels.forEach(lvl => {
    const opt = document.createElement("option");
    opt.value = lvl.id;
    const best = typeof lvl.bestScore === "number" && isFinite(lvl.bestScore) ? `${lvl.bestScore.toFixed(2)}s` : "--";
    const bestDots = typeof lvl.bestDots === "number" && lvl.bestDots > 0 ? `${lvl.bestDots}/${NUM_DOTS}` : "--";
    opt.textContent = `${lvl.name} (Best: ${best}, Dots: ${bestDots})`;
    select.appendChild(opt);
  });
}

function syncUrlToSeed() {
  if (state.skipNextHashChange) return;
  if (state.currentLevelSeed != null && state.currentLevelSeed > 0) {
    const difficulty = state.currentDifficulty != null ? Math.max(1, Math.min(30, Math.floor(state.currentDifficulty))) : null;
    const newHash = "#" + state.currentLevelSeed + (difficulty != null ? "/" + difficulty : "");
    if (location.hash !== newHash) {
      state.skipNextHashChange = true;
      location.hash = state.currentLevelSeed + (difficulty != null ? "/" + difficulty : "");
    }
  } else {
    if (location.hash !== "") {
      state.skipNextHashChange = true;
      location.hash = "";
    }
  }
}

function loadLevelFromHash() {
  if (state.skipNextHashChange) {
    state.skipNextHashChange = false;
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
    state.lives = LIVES_START;
    resetPlayerToStart();
    return true;
  }
  return false;
}

function runFPSBenchmark(callback) {
  let frameCount = 0;
  const t0 = performance.now();
  function measureFrame(t) {
    frameCount++;
    const elapsed = t - t0;
    if (elapsed >= 400 || frameCount >= 60) {
      state.measuredFPS = frameCount / (elapsed / 1000);
      if (state.measuredFPS < 20) state.measuredFPS = 20;
      if (state.measuredFPS > 120) state.measuredFPS = 120;
      if (typeof callback === "function") callback();
      return;
    }
    requestAnimationFrame(measureFrame);
  }
  requestAnimationFrame(measureFrame);
}

function loop(timestamp) {
  if (typeof timestamp !== "number") timestamp = performance.now();
  if (!state.lastFrameTime) state.lastFrameTime = timestamp;
  let deltaMs = timestamp - state.lastFrameTime;
  state.lastFrameTime = timestamp;
  const dt = Math.min(deltaMs / 1000, DT_CAP);

  state.ctx.clearRect(0, 0, state.W, state.H);
  drawAll();
  update(dt);
  if (state.gameWon) {
    updateWinOverlay();
  } else {
    updateWinOverlay();
  }
  requestAnimationFrame(loop);
}

// --- Init: canvas and state
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
state.canvas = canvas;
state.ctx = ctx;
state.W = canvas.width;
state.H = canvas.height;
initLava(state.H);
state.loadAllLevels = loadAllLevels;
state.populateLevelDropdown = populateLevelDropdown;
state.syncUrlToSeed = syncUrlToSeed;

bindInput();

document.getElementById("levelSelect").addEventListener("change", e => {
  const value = e.target.value;
  const data = loadAllLevels(state.H);
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
  const seed = state.currentLevelSeed;
  if (seed == null || seed <= 0) {
    alert("This level cannot be shared by link.");
    return;
  }
  const difficulty = state.currentDifficulty != null ? Math.max(1, Math.min(30, Math.floor(state.currentDifficulty))) : null;
  const url = location.origin + location.pathname + "#" + seed + (difficulty != null ? "/" + difficulty : "");
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
  const data = loadAllLevels(state.H);
  if (!data.levels.length) return;
  const idx = data.levels.findIndex(l => l.id === state.currentLevelID);
  const nextLevel = (idx >= 0 && idx < data.levels.length - 1) ? data.levels[idx + 1] : data.levels[0];
  loadLevel(nextLevel);
});

document.getElementById("winReplayBtn").addEventListener("click", () => {
  state.lastCheckpointIndex = -1;
  state.lives = LIVES_START;
  resetPlayerToStart();
});

window.addEventListener("hashchange", () => loadLevelFromHash());

populateLevelDropdown();
if (!loadLevelFromHash()) {
  generateRandomLevel();
  resetPlayerToStart();
}

requestAnimationFrame(loop);
runFPSBenchmark();
