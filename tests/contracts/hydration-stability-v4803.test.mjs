import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const language = src("src/components/LanguageProvider.tsx");
const cart = src("src/components/CartProvider.tsx");
const mobileNav = src("src/components/MobileBottomNav.tsx");
const productCard = src("src/components/ProductCard.tsx");
const layout = src("src/app/layout.tsx");
const e2e = src("tests/e2e/hydration-stability-v4803.spec.ts");

test("V480.3 keeps language first render deterministic and restores persistence after mount", () => {
  assert.match(
    language,
    /const \[language, setLanguageState\] = useState<Language>\("fr"\)/,
  );
  assert.match(language, /useEffect\(\(\) => \{/);
  assert.match(language, /window\.localStorage\.getItem\("ichigo-language"\)/);
  assert.doesNotMatch(
    language,
    /useState<Language>\(\(\) =>[\s\S]*?localStorage/,
  );
});

test("V480.3 keeps cart first render empty and restores saved cart after mount", () => {
  assert.match(cart, /const \[items, setItems\] = useState<CartItem\[\]>\(\[\]\)/);
  assert.match(cart, /const \[hydrated, setHydrated\] = useState\(false\)/);
  assert.match(cart, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(
    cart,
    /useState<CartItem\[\]>\(\(\) =>[\s\S]*?localStorage/,
  );
});

test("V480.3 keeps location hash deterministic during server hydration", () => {
  assert.match(
    mobileNav,
    /function readServerHashSection\(\): SectionId \{\s*return "";\s*\}/,
  );
  assert.match(
    mobileNav,
    /useSyncExternalStore<SectionId>\(subscribeHashSection, readHashSection, readServerHashSection\)/,
  );
});

test("V480.3 keeps client-only ProductCard portal state behind an explicit server snapshot", () => {
  assert.match(
    productCard,
    /useSyncExternalStore\(\(\) => \(\) => \{\}, \(\) => true, \(\) => false\)/,
  );
  assert.match(productCard, /createPortal/);
});

test("V480.3 browser guard covers React 418 and general hydration mismatch messages", () => {
  assert.match(e2e, /minified react error #418/);
  assert.match(e2e, /hydration failed/);
  assert.match(e2e, /hydration mismatch/);
  assert.match(e2e, /server rendered html/);
  assert.match(e2e, /didn't match/);
  assert.match(e2e, /page\.on\("pageerror"/);
  assert.match(e2e, /page\.on\("console"/);
});

test("V480.3 browser guard covers home, shop, canonical product, persisted EN and stored cart", () => {
  assert.match(e2e, /page\.goto\("\/"\)/);
  assert.match(e2e, /page\.goto\("\/boutique"\)/);
  assert.match(e2e, /main\[data-product-page-v431\]/);
  assert.match(e2e, /window\.localStorage\.setItem\("ichigo-language", "en"\)/);
  assert.match(e2e, /ichigo-ichie-v2-cart/);
  assert.match(e2e, /toHaveText\("2"\)/);
});

test("V480.3 does not silence hydration warnings in production markup", () => {
  for (const source of [language, cart, mobileNav, productCard, layout]) {
    assert.doesNotMatch(source, /suppressHydrationWarning/);
  }
});
