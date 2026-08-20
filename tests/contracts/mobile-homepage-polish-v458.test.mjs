import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const home = readFileSync(resolve(root, "src/components/HomePageContent.tsx"), "utf8");
const mobileNav = readFileSync(resolve(root, "src/components/MobileBottomNav.tsx"), "utf8");

const marker = "/* Ichigo Ichie V4.58 — Mobile homepage polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V458 CSS marker must exist");
const v458 = css.slice(start);

test("V458 mobile hero has dedicated compact responsive treatment", () => {
  assert.ok(v458.includes("@media (max-width: 760px)"));
  assert.ok(v458.includes(".hero-mobile-v260 .hero-visual-v224"));
  assert.ok(v458.includes("height: min(38dvh, 340px) !important;"));
  assert.ok(v458.includes("min-height: 238px !important;"));
  assert.ok(v458.includes("max-height: 340px !important;"));
  assert.ok(v458.includes("object-fit: cover !important;"));
  assert.ok(v458.includes("border-radius: 28px !important;"));
});

test("V458 preserves desktop hero behavior by staying mobile scoped", () => {
  assert.equal(v458.includes("@media (min-width:"), false);
  assert.equal(v458.includes(".hero-v224 {\n"), false);
});

test("V458 mobile headline remains serif and avoids overly large wrapping", () => {
  assert.ok(v458.includes(".hero-mobile-v260 h1"));
  assert.ok(v458.includes("font-family: var(--serif) !important;"));
  assert.ok(v458.includes("font-size: clamp(35px, 10.4vw, 46px) !important;"));
  assert.ok(v458.includes("line-height: 1.03 !important;"));
  assert.ok(v458.includes("text-wrap: balance;"));
  assert.ok(home.includes("Japanese matcha, in its gentlest form.") || home.includes('t("home_title_fr", "home_title_en")'));
});

test("V458 mobile bottom navigation respects safe-area while becoming more compact", () => {
  assert.ok(v458.includes("--mobile-nav-space: 86px"));
  assert.ok(v458.includes("bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;"));
  assert.ok(v458.includes("height: 62px !important;"));
  assert.ok(v458.includes("min-height: 50px !important;"));
  assert.ok(v458.includes("padding: 4px 6px !important;"));
});

test("V458 public content has bottom clearance for the fixed navigation", () => {
  assert.ok(v458.includes("main {\n    padding-bottom:"));
  assert.ok(v458.includes("var(--mobile-nav-space)"));
  assert.ok(v458.includes("env(safe-area-inset-bottom, 0px)"));
  assert.equal(v458.includes("300px"), false);
  assert.equal(v458.includes("400px"), false);
});

test("V458 keeps all five mobile navigation destinations unchanged", () => {
  for (const href of ["/#boutique", "/#menu", "/#maison", "/compte", "/panier"]) {
    assert.ok(mobileNav.includes(`href="${href}"`));
  }
  assert.ok(mobileNav.includes('language === "fr" ? "Carte" : "Menu"'));
  assert.ok(mobileNav.includes('language === "fr" ? "Maison" : "About"'));
  assert.ok(mobileNav.includes('language === "fr" ? "Compte" : "Account"'));
  assert.ok(mobileNav.includes('nav_cart_fr'));
});

test("V458 keeps homepage CTA/content visible above fixed navigation", () => {
  assert.ok(home.includes('className="hero-actions hero-actions-v224"'));
  assert.ok(home.includes('href="/#boutique"'));
  assert.ok(home.includes('href="/#menu"'));
  assert.ok(v458.includes(".hero-mobile-v260 .hero-actions-v224"));
  assert.equal(v458.includes("display: none"), false);
  assert.equal(v458.includes("visibility: hidden"), false);
});
