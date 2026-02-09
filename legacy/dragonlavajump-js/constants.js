/**
 * Game constants. Physics and sizes derived from REFERENCE_FPS (60) for delta-time.
 */
export const LEVEL_LENGTH = 4000;
export const REFERENCE_FPS = 60;

export const gravity = 0.5 * REFERENCE_FPS * REFERENCE_FPS; // px/s²
export const moveSpeed = 3.5 * REFERENCE_FPS;               // px per second
export const jumpStrength = 10 * REFERENCE_FPS;             // initial upward vy (px/s)

export const NUM_DOTS = 30;
export const DOT_R = 3.5;
export const DOT_SAFETY_MARGIN = 15;
export const SLIME_AVOID_BAND = 0.28;

export const POLE_W = 12;
export const POLE_H = 40;

export const LIVES_START = 3;
export const TRAIL_LENGTH = 14;

export const SLIME_JUMP_STRENGTH = 7 * REFERENCE_FPS;

export const BAT_W = 24;
export const BAT_H = 16;
export const BAT_MAX_SPEED = 2.2 * REFERENCE_FPS;
export const BAT_WANDER_STRENGTH = 0.5 * REFERENCE_FPS;

export const CRAWLER_W = 20;
export const CRAWLER_H = 14;
export const CRAWLER_PERIMETER_SPEED = 0.004 * REFERENCE_FPS;

export const DRAGON_MOUTH_OVERHANG = 6;
export const DOT_MOUTH_HALF_W = 6;

export const DT_CAP = 0.05;
export const BENCHMARK_DURATION_MS = 400;
export const BENCHMARK_MIN_FRAMES = 20;
