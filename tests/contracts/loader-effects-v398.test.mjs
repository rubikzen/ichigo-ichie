import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const invoice = readFileSync(
  resolve(root, "src/components/InvoiceSettingsAdmin.tsx"),
  "utf8",
);
const stats = readFileSync(
  resolve(root, "src/components/OrderStatistics.tsx"),
  "utf8",
);
const gallery = readFileSync(
  resolve(root, "src/components/ProductGalleryAdmin.tsx"),
  "utf8",
);

test("invoice settings initial loader is deferred and cancellation-safe", () => {
  assert.match(
    invoice,
    /useEffect\(\(\) => \{\s+let cancelled = false;\s+queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void load\(\);/,
  );
  assert.match(invoice, /return \(\) => \{ cancelled = true; \};/);
  assert.doesNotMatch(
    invoice,
    /useEffect\(\(\) => \{ void load\(\); \}, \[\]\)/,
  );
});

test("order statistics loader is deferred without changing its dependencies", () => {
  assert.match(
    stats,
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void load\(\);/,
  );
  assert.match(stats, /\}, \[load, refreshKey\]\);/);
  assert.doesNotMatch(
    stats,
    /useEffect\(\(\) => \{ load\(\); \}, \[load, refreshKey\]\)/,
  );
});

test("product gallery loader is deferred and remains keyed by productId", () => {
  assert.match(
    gallery,
    /queueMicrotask\(\(\) => \{\s+if \(!cancelled\) void load\(\);/,
  );
  assert.match(
    gallery,
    /\}, \[productId\]\); \/\/ eslint-disable-line react-hooks\/exhaustive-deps/,
  );
  assert.doesNotMatch(
    gallery,
    /useEffect\(\(\) => \{ load\(\); \}, \[productId\]\)/,
  );
});
