import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/admin/AdminCatalogEditors.tsx"), "utf8");
const orders = readFileSync(resolve(root, "src/components/admin/AdminOrders.tsx"), "utf8");
const settings = readFileSync(resolve(root, "src/components/admin/AdminSettings.tsx"), "utf8");

test("admin category prop synchronization is deferred and cancellation-safe", () => {
  assert.match(catalog, /queueMicrotask\(\(\) => \{/);
  assert.match(catalog, /if \(!cancelled\) setRows\(categories\)/);
  assert.match(catalog, /return \(\) => \{ cancelled = true; \}/);
  assert.doesNotMatch(catalog, /useEffect\(\(\) => setRows\(categories\)/);
});

test("admin order sound hydration and initial load are deferred", () => {
  assert.match(orders, /queueMicrotask\(\(\) => \{/);
  assert.match(orders, /localStorage\.getItem\("ichigo-order-sound"\)/);
  assert.match(orders, /setOrderSoundEnabled\(enabled\)/);
  assert.match(orders, /void loadOrders\(\)/);
  assert.match(orders, /cancelled = true/);
});

test("shipping settings loader is stable and initialized outside the effect body", () => {
  assert.match(settings, /useCallback/);
  assert.match(settings, /const load = useCallback\(async \(\) => \{/);
  assert.match(settings, /\}, \[supabase\]\);/);
  assert.match(settings, /queueMicrotask\(\(\) => \{/);
  assert.match(settings, /if \(!cancelled\) void load\(\)/);
  assert.match(settings, /\}, \[load\]\);/);
  assert.doesNotMatch(settings, /useEffect\(\(\) => \{ load\(\); \}, \[\]\)/);
});
