import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const cart = readFileSync(resolve(root, "src/components/CartProvider.tsx"), "utf8");
const language = readFileSync(resolve(root, "src/components/LanguageProvider.tsx"), "utf8");
const nav = readFileSync(resolve(root, "src/components/MobileBottomNav.tsx"), "utf8");

test("cart hydration defers localStorage state synchronization outside the effect body", () => {
  assert.match(cart, /queueMicrotask\(\(\) => \{/);
  assert.match(cart, /if \(raw\) setItems\(JSON\.parse\(raw\)\)/);
  assert.match(cart, /setHydrated\(true\)/);
  assert.match(cart, /cancelled = true/);
});

test("language preference hydration is deferred and remains cancel-safe", () => {
  assert.match(language, /queueMicrotask\(\(\) => \{/);
  assert.match(language, /setLanguageState\(initial\)/);
  assert.match(language, /persistLanguage\(initial\)/);
  assert.match(language, /cancelled = true/);
});

test("mobile navigation derives inactive state off-home instead of setting it in an effect", () => {
  assert.match(nav, /if \(!onHome\) return;/);
  assert.match(nav, /const visibleActive: SectionId = onHome \? active : "";/);
  assert.doesNotMatch(nav, /if \(!onHome\) \{\s*setActive\(""\)/);
  assert.match(nav, /visibleActive === "menu"/);
  assert.match(nav, /visibleActive === "boutique"/);
  assert.match(nav, /visibleActive === "maison"/);
});
