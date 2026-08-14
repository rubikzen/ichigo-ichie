import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const production = readFileSync(
  resolve(root, "src/components/ProductionAdmin.tsx"),
  "utf8",
);
const promotions = readFileSync(
  resolve(root, "src/components/PromotionsAdmin.tsx"),
  "utf8",
);
const media = readFileSync(
  resolve(root, "src/components/SiteMediaField.tsx"),
  "utf8",
);

test("production health refresh is deferred and cancellation-safe", () => {
  assert.match(
    production,
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void refresh\(\);/,
  );
  assert.match(production, /\}, \[refresh\]\);/);
  assert.doesNotMatch(
    production,
    /useEffect\(\(\) => \{ void refresh\(\); \}, \[refresh\]\)/,
  );
});

test("promotion loader is deferred and cancellation-safe", () => {
  assert.match(
    promotions,
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void load\(\);/,
  );
  assert.match(promotions, /return \(\) => \{ cancelled = true; \};/);
  assert.doesNotMatch(
    promotions,
    /useEffect\(\(\) => \{ load\(\); \}, \[\]\)/,
  );
});

test("inline media library refresh only runs after opening and is deferred", () => {
  assert.match(media, /if \(!libraryOpen\) return;/);
  assert.match(
    media,
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void refresh\(\);/,
  );
  assert.match(
    media,
    /\}, \[libraryOpen\]\); \/\/ eslint-disable-line react-hooks\/exhaustive-deps/,
  );
  assert.doesNotMatch(
    media,
    /useEffect\(\(\) => \{ if \(libraryOpen\) refresh\(\); \}, \[libraryOpen\]\)/,
  );
});

test("site media library initial refresh is deferred", () => {
  const deferredRefreshes = media.match(
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void refresh\(\);/g,
  ) ?? [];
  assert.ok(deferredRefreshes.length >= 2);
  assert.doesNotMatch(
    media,
    /useEffect\(\(\) => \{ refresh\(\); \}, \[\]\)/,
  );
});
