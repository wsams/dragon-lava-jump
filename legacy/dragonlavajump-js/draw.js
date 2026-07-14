/**
 * All drawing: world, entities, dragon, HUD, win overlay. Reads state and constants.
 */
import { state } from "./state.js";
import {
  NUM_DOTS,
  LIVES_START,
  POLE_W,
  POLE_H,
  DRAGON_MOUTH_OVERHANG
} from "./constants.js";

function drawPlatforms() {
  const { ctx, platforms, cameraX, currentTime } = state;
  for (const p of platforms) {
    ctx.fillStyle = "#8b5cf6";
    const screenX = p.x - cameraX;
    let yTop = p.y;
    const yBottom = p.y + p.h;
    if (p.drop && p.dropActive && !p.dropping) {
      const t = currentTime || 0;
      yTop += Math.sin(t * 20 + screenX * 0.05) * 1.5;
      ctx.fillStyle = "#a855f7";
    }
    if (p.bend) {
      const jointX = screenX + p.w * p.bend.joint;
      const bendH = p.bend.bendHeight;
      ctx.beginPath();
      ctx.moveTo(screenX, yTop);
      ctx.lineTo(jointX, yTop + bendH);
      ctx.lineTo(screenX + p.w, yTop);
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
  const { ctx, platforms, checkpointDefs, lastCheckpointIndex, cameraX, W } = state;
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
    ctx.fillStyle = "#4a5568";
    ctx.fillRect(sx, poleTop, POLE_W, POLE_H);
    ctx.strokeStyle = "#2d3748";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, poleTop, POLE_W, POLE_H);
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
    if (i === lastCheckpointIndex) {
      ctx.strokeStyle = "rgba(255, 220, 100, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 1, poleTop - 1, POLE_W + 2, POLE_H + 2);
    }
    ctx.restore();
  }
}

function drawSlimes() {
  const { ctx, slimes, cameraX } = state;
  for (const s of slimes) {
    if (s.dead) continue;
    ctx.fillStyle = "#4ade80";
    ctx.fillRect(s.x - cameraX, s.y, s.w, s.h);
    ctx.fillStyle = "#000";
    const eyeY = s.y + 5;
    ctx.fillRect(s.x - cameraX + 4, eyeY, 3, 3);
    ctx.fillRect(s.x - cameraX + s.w - 7, eyeY, 3, 3);
  }
}

function drawBats() {
  const { ctx, bats, cameraX, W } = state;
  for (const b of bats) {
    const sx = b.x - cameraX;
    if (sx < -b.w - 20 || sx > W + 20) continue;
    const cx = sx + b.w / 2;
    const cy = b.y + b.h / 2;
    ctx.save();
    ctx.fillStyle = "#1e1e28";
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 2);
    ctx.quadraticCurveTo(cx - 18, cy + 2, cx - 12, cy + 10);
    ctx.quadraticCurveTo(cx - 6, cy + 6, cx - 4, cy - 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - 2);
    ctx.quadraticCurveTo(cx + 18, cy + 2, cx + 12, cy + 10);
    ctx.quadraticCurveTo(cx + 6, cy + 6, cx + 4, cy - 2);
    ctx.fill();
    ctx.fillStyle = "#2d2d3a";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, b.h / 2 + 1, 0, 0, Math.PI * 2);
    ctx.fill();
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
  const { ctx, crawlers, cameraX, W } = state;
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
  const { ctx, ceilingPoints, stalactites, cameraX, W } = state;
  if (ceilingPoints.length > 1) {
    ctx.fillStyle = "#5b3f86";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let i = ceilingPoints.length - 1; i >= 0; i--) {
      const p = ceilingPoints[i];
      const sx = p.x - cameraX;
      if (sx < -100 || sx > W + 100) continue;
      ctx.lineTo(sx, p.y);
    }
    ctx.closePath();
    ctx.fill();
  }
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
  const { ctx, lava, cameraX } = state;
  ctx.fillStyle = "#ff4b3e";
  ctx.fillRect(lava.x - cameraX, lava.y, lava.w, lava.h);
}

function drawGoal() {
  const { ctx, goal, cameraX } = state;
  ctx.fillStyle = "#ffd93d";
  ctx.fillRect(goal.x - cameraX, goal.y, goal.w, goal.h);
}

function drawDots() {
  const { ctx, dotDefs, dotsCollected, cameraX, W } = state;
  const size = 3.2;
  for (let i = 0; i < dotDefs.length; i++) {
    if (dotsCollected[i]) continue;
    const d = dotDefs[i];
    const sx = d.x - cameraX;
    if (sx + size + 2 < 0 || sx - size - 2 > W) continue;
    ctx.save();
    ctx.translate(sx, d.y);
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
  const { ctx, itemDefs, fireTotemCollected, lavaBounceItemCollected, cameraX, W } = state;
  const t = (performance.now() / 1000) * 2;
  for (const item of itemDefs) {
    if (item.type === "fireTotem") {
      if (fireTotemCollected) continue;
      const sx = item.x - cameraX;
      if (sx < -item.w - 40 || sx > W + 40) continue;
      const cx = sx + item.w / 2;
      ctx.save();
      ctx.fillStyle = "#5c4a3a";
      ctx.fillRect(sx + 4, item.y + 8, item.w - 8, item.h - 8);
      ctx.fillStyle = "#6b5a4a";
      ctx.fillRect(sx + 6, item.y + 10, item.w - 12, 4);
      ctx.fillRect(sx + 6, item.y + item.h - 18, item.w - 12, 4);
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
    const pulse = 0.5 + 0.3 * Math.sin(t * 3);
    for (let r = 12; r <= 22; r += 5) {
      ctx.strokeStyle = `rgba(255, 180, 80, ${0.25 * pulse * (1 - (r - 12) / 15)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + Math.sin(t * 2 + r) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  const { ctx, dragon, cameraX } = state;
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

function drawDragonAt(wx, wy, facing, alpha, hasFireBreath, drawFlame) {
  const { ctx, dragon, cameraX } = state;
  const w = dragon.w;
  const h = dragon.h;
  const sx = wx - cameraX;
  const dir = facing === 1 ? 1 : -1;
  const fire = !!hasFireBreath;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, wy);
  if (dir === -1) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);
  }

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

  ctx.fillStyle = fire ? "#c9702a" : "#5ab35a";
  ctx.beginPath();
  ctx.ellipse(14, h / 2 + 2, 10, h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fire ? "#e08840" : "#6bd96b";
  ctx.beginPath();
  ctx.ellipse(14, h / 2 + 3, 8, h / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();
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

  ctx.fillStyle = fire ? "#e08840" : "#6bd96b";
  ctx.beginPath();
  ctx.moveTo(20, h / 2 - 2);
  ctx.quadraticCurveTo(28, 4, 32, 2);
  ctx.lineTo(30, h / 2 + 2);
  ctx.quadraticCurveTo(24, h / 2, 20, h / 2 - 2);
  ctx.fill();

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

  ctx.fillStyle = "#7a6b4a";
  ctx.beginPath();
  ctx.moveTo(w + 2, 6);
  ctx.lineTo(w + 6, 2);
  ctx.lineTo(w + 4, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = fire ? "#fff0b0" : "#f9f3c2";
  ctx.beginPath();
  ctx.arc(26, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a14";
  ctx.beginPath();
  ctx.arc(27, 8, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fire ? "#9a4a18" : "#3d853d";
  ctx.beginPath();
  ctx.arc(w - 2, 12, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fire ? "#b85c20" : "#4a9b4a";
  ctx.fillRect(18, h - 4, 4, 6);
  ctx.fillStyle = fire ? "#9a4a18" : "#3d853d";
  ctx.beginPath();
  ctx.ellipse(20, h + 2, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (drawFlame) {
    const flameLen = 50;
    const flameY = 4;
    const flameH = h - 8;
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
  const { dragonTrail } = state;
  if (dragonTrail.length === 0) return;
  const n = dragonTrail.length;
  for (let i = 0; i < n; i++) {
    const t = dragonTrail[i];
    const alpha = 0.08 + (i / n) * 0.35;
    drawDragonAt(t.x, t.y, t.facing, alpha, false, false);
  }
}

function drawDragon() {
  const { dragon, lavaBounceTimer, fireBreathsLeft, breathActiveTime } = state;
  drawDragonTrail();
  let drawMainDragon = true;
  if (lavaBounceTimer > 0) {
    const elapsed = 5 - lavaBounceTimer;
    const interval = 0.1 + 0.7 * (lavaBounceTimer / 5);
    const cyclePhase = elapsed % interval;
    drawMainDragon = cyclePhase >= 0.08;
  }
  if (drawMainDragon) {
    drawDragonAt(dragon.x, dragon.y, dragon.facing, 1, fireBreathsLeft > 0, breathActiveTime > 0);
  }
  if (lavaBounceTimer > 0) drawLavaBounceAura();
}

function drawHUD() {
  const { ctx, W, currentTime, bestScore, dotsCollectedCount, lives, currentDifficulty, currentLevelSeed, currentLevelID, fireBreathsLeft } = state;
  const hasFire = fireBreathsLeft > 0;
  const hudH = hasFire ? 150 : 132;
  ctx.fillStyle = "#00000088";
  ctx.fillRect(10, 10, 260, hudH);
  ctx.fillStyle = "#fff";
  ctx.font = "14px sans-serif";
  ctx.fillText("Time: " + currentTime.toFixed(2), 20, 35);
  ctx.fillText(bestScore !== Infinity ? "Best: " + bestScore.toFixed(2) : "Best: --", 20, 55);
  ctx.fillText("Dots: " + dotsCollectedCount + "/" + NUM_DOTS, 20, 75);
  ctx.fillText("Lives: " + "♥".repeat(lives) + "♡".repeat(LIVES_START - lives), 20, 95);
  const displayDiff = currentDifficulty != null ? Math.max(1, Math.min(30, Math.floor(currentDifficulty))) : null;
  const levelLabel = currentLevelSeed != null && currentLevelSeed > 0 ? String(currentLevelSeed) : (currentLevelID || "--");
  ctx.fillText("Level: " + levelLabel + (displayDiff != null ? "  (Diff " + displayDiff + ")" : ""), 20, 115);
  if (hasFire) {
    ctx.fillStyle = "#ffb84d";
    ctx.fillText("Flame shield (G)", 20, 135);
  }
}

function drawWinMessage() {
  const { ctx, W, H } = state;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
}

export function updateWinOverlay() {
  const { gameWon, currentTime, dotsCollectedCount, bestScore, currentLevelID } = state;
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
      if (bestScore !== Infinity && Math.abs(currentTime - bestScore) < 0.01) bestEl.textContent = "New best!";
      else if (bestScore !== Infinity) bestEl.textContent = "Best: " + bestScore.toFixed(2) + "s";
      else bestEl.textContent = "Best: --";
    }
    const nextBtn = document.getElementById("winNextLevelBtn");
    if (nextBtn && state.loadAllLevels) {
      const data = state.loadAllLevels(state.H);
      if (data.levels && data.levels.length > 0) {
        const idx = data.levels.findIndex(l => l.id === currentLevelID);
        nextBtn.style.display = "";
        nextBtn.textContent = (idx >= 0 && idx < data.levels.length - 1) ? "Next level →" : "First level →";
      }
    }
  } else {
    el.style.display = "none";
  }
}

export function drawAll() {
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
  drawDragon();
  drawHUD();
  if (state.gameWon) drawWinMessage();
}
