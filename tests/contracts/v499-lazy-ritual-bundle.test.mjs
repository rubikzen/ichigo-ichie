import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const unified = src("src/components/UnifiedCatalogSections.tsx");

test("V499 moves the ritual bundle out of the initial homepage catalogue module graph", () => {
  assert.match(unified, /import dynamic from "next\/dynamic"/);
  assert.doesNotMatch(
    unified,
    /import\s+\{\s*RitualBundleBuilder\s*\}\s+from\s+"\.\/RitualBundleBuilder"/,
  );
  assert.match(
    unified,
    /dynamic\(\(\)\s*=>\s*import\("\.\/RitualBundleBuilder"\)\.then\(\(module\)\s*=>\s*module\.RitualBundleBuilder\)/,
  );
});

test("V499 preserves server rendering and the existing shop bundle placement", () => {
  assert.doesNotMatch(unified, /ssr\s*:\s*false/);
  assert.match(
    unified,
    /kind === "shop"[\s\S]*?<RitualBundleBuilder products=\{products\} \/>/,
  );
});
