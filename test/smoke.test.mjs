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
  ".github/workflows/pages.yml",
  ".nojekyll",
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
assert.match(
  html,
  /href="https:\/\/github\.com\/wsams\/dragon-lava-jump"/,
  "index.html footer should link back to the GitHub repo"
);
assert.match(html, /View on GitHub/, "index.html should label the repo link");

const readme = readFileSync(join(root, "README.md"), "utf8");
assert.match(
  readme,
  /wsams\.github\.io\/dragon-lava-jump/,
  "README should link to the GitHub Pages play URL"
);
assert.match(
  readme,
  /img\.shields\.io\/badge\/Play_now/,
  "README should include a Play now badge"
);

const game = readFileSync(join(root, "js/game-phaser.js"), "utf8");
assert.match(game, /function detectBackend\s*\(/, "game should detect optional backend");
assert.match(game, /function storageGet\s*\(/, "game should use storageGet for persistence");
assert.match(game, /function storageSet\s*\(/, "game should use storageSet for persistence");
assert.match(game, /BACKEND_MODE_LOCAL/, "game should define local backend mode");
assert.match(game, /api\/health\.php/, "game should probe PHP health endpoint");
assert.match(game, /detectBackend\(\)\.then/, "init should wait for backend detection");
assert.match(game, /localStorage\.getItem/, "storageGet should read localStorage");
assert.match(game, /localStorage\.setItem/, "storageSet should write localStorage");
// Persistence helpers should be the only writers; feature code uses storageGet/storageSet.
assert.equal(
  (game.match(/localStorage\.setItem/g) || []).length,
  1,
  "only storageSet should call localStorage.setItem"
);
assert.equal(
  (game.match(/localStorage\.getItem/g) || []).length,
  1,
  "only storageGet should call localStorage.getItem"
);

const pagesWorkflow = readFileSync(
  join(root, ".github/workflows/pages.yml"),
  "utf8"
);
assert.match(pagesWorkflow, /actions\/deploy-pages/, "pages workflow should deploy to Pages");
assert.match(pagesWorkflow, /upload-pages-artifact/, "pages workflow should upload artifact");
assert.match(pagesWorkflow, /_site/, "pages workflow should assemble _site");
assert.match(
  pagesWorkflow,
  /enablement:\s*true/,
  "pages workflow should attempt Pages enablement"
);
assert.match(
  pagesWorkflow,
  /settings\/pages/,
  "pages workflow should link to Settings → Pages when enablement fails"
);
assert.match(
  readme,
  /Settings → Pages/,
  "README should document the one-time Pages settings step"
);

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

const minified = readFileSync(join(root, "js/main.min.js"), "utf8");
assert.match(minified, /__dragonBackendMode/, "minified build should expose backend mode");

console.log("smoke tests passed");
