import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

test("package exposes a lint command", () => {
  assert.equal(pkg.scripts?.lint, "eslint .");
});

test("CI runs lint before build", () => {
  const lintIndex = ci.indexOf("run: npm run lint");
  const buildIndex = ci.indexOf("run: npm run build");
  assert.ok(lintIndex >= 0, "CI must run npm run lint");
  assert.ok(buildIndex >= 0, "CI must run npm run build");
  assert.ok(lintIndex < buildIndex, "lint should run before build");
});

test("CI keeps full verification chain", () => {
  for (const command of [
    "run: npm ci",
    "run: npm run lint",
    "run: npm run build",
    "run: npm run test:contracts",
    "run: npm run e2e:local",
    "run: npm run smoke",
  ]) {
    assert.ok(ci.includes(command), `CI is missing: ${command}`);
  }
});

test("CI remains limited to main push and pull requests", () => {
  assert.ok(ci.includes("push:"));
  assert.ok(ci.includes("pull_request:"));
  assert.ok(ci.includes("branches:"));
  assert.ok(ci.includes("- main"));
});
