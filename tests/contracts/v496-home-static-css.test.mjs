import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const home = src("src/components/HomePageContent.tsx");
const homeCss = src("src/app/styles/home-mobile-v496.css");

test("V496 keeps homepage mobile CSS out of the hydrated HomePageContent module", () => {
  assert.match(page, /import "\.\/styles\/home-mobile-v496\.css"/);
  assert.doesNotMatch(home, /<style jsx global>/);
  assert.doesNotMatch(home, /@media \(max-width: 760px\)/);
});

test("V496 preserves the critical mobile homepage selectors in static CSS", () => {
  assert.match(homeCss, /\.mobile-home-flow-v260/);
  assert.match(homeCss, /\.hero-mobile-v260/);
  assert.match(homeCss, /\.mobile-trust-grid-v260/);
  assert.match(homeCss, /\.premium-home-mobile-v260 \.onepage-catalog/);
  assert.match(homeCss, /@media \(max-width: 760px\)/);
});
