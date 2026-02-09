/**
 * Deterministic RNG for reproducible level generation.
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}
