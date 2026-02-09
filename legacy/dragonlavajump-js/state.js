/**
 * Mutable game state. Canvas/ctx/W/H are set by main after DOM is ready.
 */
import { LEVEL_LENGTH, LIVES_START } from "./constants.js";

export const state = {
  canvas: null,
  ctx: null,
  W: 0,
  H: 0,

  dragon: {
    x: 0, y: 0, w: 30, h: 26,
    vx: 0, vy: 0,
    onGround: false, facing: 1, boostCooldown: 0, jumpsLeft: 2, boostAvailable: true, boostFramesLeft: 0
  },

  cameraX: 0,
  dragonTrail: [],
  jumpKeyReleased: true,
  timeInAir: 0,
  currentDifficulty: null,

  slimeDefs: [],
  slimes: [],
  ceilingPoints: [],
  stalactiteDefs: [],
  stalactites: [],
  batDefs: [],
  bats: [],
  crawlerDefs: [],
  crawlers: [],

  itemDefs: [],
  lavaBounceItemCollected: false,
  lavaBounceTimer: 0,
  fireBreathsLeft: 0,
  fireTotemCollected: false,
  breathActiveTime: 0,
  breathKeyConsumed: false,

  dotDefs: [],
  dotsCollected: [],
  dotsCollectedCount: 0,
  checkpointDefs: [],
  lastCheckpointIndex: -1,
  basePlatforms: [],

  platforms: [],
  startPlatform: null,
  goal: null,
  bestScore: Infinity,
  currentLevelID: null,
  currentLevelSeed: null,
  skipNextHashChange: false,

  lava: { x: 0, y: 0, w: LEVEL_LENGTH, h: 40 },

  timerStarted: false,
  startTime: 0,
  currentTime: 0,
  gameWon: false,
  lavaDeathTimer: 0,
  isDyingInLava: false,
  standingPlatformIndex: -1,
  lives: LIVES_START,

  measuredFPS: 60,
  lastFrameTime: 0,
  keys: { left: false, right: false, jump: false, boost: false, breath: false }
};

export function initLava(H) {
  state.lava.y = H - 20;
}
