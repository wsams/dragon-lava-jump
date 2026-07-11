import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertFile(relPath) {
  const abs = join(root, relPath);
  assert.ok(existsSync(abs), `missing required file: ${relPath}`);
  assert.ok(statSync(abs).size > 0, `file is empty: ${relPath}`);
}

const requiredFiles = [
  "index.html",
  "package.json",
  "css/styles.css",
  "js/game-phaser.js",
  "dragon.ico",
];

for (const file of requiredFiles) {
  assertFile(file);
}

const html = readFileSync(join(root, "index.html"), "utf8");
assert.match(
  html,
  /js\/(game-phaser|main\.min)\.js/,
  "index.html should load the game script"
);
assert.match(html, /css\/styles\.css/, "index.html should load css/styles.css");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(pkg.name, "dragon-lava-jump");
assert.ok(pkg.scripts?.test, "package.json must define a test script");
assert.ok(pkg.scripts?.minify, "package.json must define a minify script");

const minify = spawnSync("npm", ["run", "minify"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, HUSKY: "0" },
});
assert.equal(
  minify.status,
  0,
  `minify failed:\n${minify.stdout}\n${minify.stderr}`
);
assertFile("js/main.min.js");

console.log("smoke tests passed");
