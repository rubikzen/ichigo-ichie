import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(src("package.json"));
const globals = src("src/app/globals.css");
const prepare = src("scripts/prepare-css-v487.mjs");
const gitignore = src(".gitignore");

test("V487 generates the runtime stylesheet before dev and production builds", () => {
  assert.equal(pkg.scripts["css:prepare"], "node scripts/prepare-css-v487.mjs");
  assert.equal(pkg.scripts.predev, "npm run css:prepare");
  assert.equal(pkg.scripts.prebuild, "npm run css:prepare");
  assert.match(globals, /globals-04\.generated\.css/);
  assert.doesNotMatch(globals, /@import "\.\/styles\/globals-04\.css"/);
  assert.match(gitignore, /src\/app\/styles\/globals-04\.generated\.css/);
});

test("V487 keeps the last exact top-level CSS occurrence so cascade semantics stay stable", () => {
  assert.match(prepare, /splitTopLevelCss/);
  assert.match(prepare, /lastOccurrence\.set\(key, index\)/);
  assert.match(prepare, /lastOccurrence\.get\(key\) !== index/);
  assert.match(prepare, /unit\.replace\(\/\\\/\\\*[\\s\\S]\*\?\\\*\\\/\/g/);
  assert.match(prepare, /unbalanced braces/);
  assert.match(prepare, /unexpected closing brace/);
});

test("V487 reports measurable source generated and saved byte counts during build", () => {
  assert.match(prepare, /source=\$\{sourceBytes\}B/);
  assert.match(prepare, /generated=\$\{generatedBytes\}B/);
  assert.match(prepare, /removed=\$\{removedUnits\}/);
  assert.match(prepare, /saved=\$\{removedBytes\}B/);
});
