import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const nav = readFileSync(resolve(root, "src/components/MobileBottomNav.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const e2e = readFileSync(resolve(root, "tests/e2e/mobile-smoke.spec.ts"), "utf8");

test("mobile navigation understands route and hash section identity", () => {
  assert.match(nav, /function sectionFromPathname\(pathname: string\): SectionId/);
  assert.match(nav, /pathname === "\/boutique"[\s\S]*return "boutique"/);
  assert.match(nav, /useSyncExternalStore<SectionId>\(subscribeHashSection, readHashSection, readServerHashSection\)/);
  assert.match(nav, /function readServerHashSection\(\): SectionId/);
  assert.match(nav, /const visibleActive: SectionId = pathSection \|\| \(onHome \? active \|\| hashSection : ""\)/);
});

test("homepage section observer ranks the viewport marker instead of stale intersection ratios", () => {
  assert.match(nav, /const marker = Math\.min\(window\.innerHeight \* 0\.42, 420\)/);
  assert.match(nav, /const containsMarker = rect\.top <= marker && rect\.bottom >= marker/);
  assert.match(nav, /\.sort\(\(a, b\) => a\.distance - b\.distance \|\| Math\.abs\(a\.top\) - Math\.abs\(b\.top\)\)/);
  assert.doesNotMatch(nav, /sort\(\(a, b\) => b\.intersectionRatio - a\.intersectionRatio\)/);
});

test("mobile section links expose the active location accessibly", () => {
  for (const id of ["menu", "boutique", "maison"]) {
    assert.match(
      nav,
      new RegExp(`href="/#${id}"[\\s\\S]*?aria-current=\\{visibleActive === "${id}" \\? "location" : undefined\\}`),
    );
  }
  assert.match(e2e, /mobile dock marks Boutique active after a Boutique hash jump/);
  assert.match(e2e, /toHaveAttribute\("aria-current", "location"\)/);
});

test("V417 compacts only the mobile Boutique entry flow", () => {
  assert.match(css, /Ichigo Ichie V4\.17 — Mobile Boutique navigation & above-the-fold/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.onepage-divider\s*\{[\s\S]*?margin-top:\s*28px !important;[\s\S]*?margin-bottom:\s*24px !important;/);
  assert.match(css, /\.onepage-catalog-shop\s*\{[\s\S]*?padding-top:\s*34px !important;[\s\S]*?scroll-margin-top:\s*104px;/);
  assert.match(css, /\.onepage-catalog-shop > \.onepage-section-heading\s*\{[\s\S]*?margin-bottom:\s*18px !important;/);
  assert.match(css, /\.onepage-catalog-shop \.onepage-catalog-toolbar-v225\s*\{[\s\S]*?margin-bottom:\s*22px !important;/);
});
