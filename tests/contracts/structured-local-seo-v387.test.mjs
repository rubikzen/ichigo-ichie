import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const layout = readFileSync(resolve(root, "src/app/layout.tsx"), "utf8");

test("local business structured data matches the public Google Business identity", () => {
  assert.match(layout, /alternateName: "Ichigo Ichie Nice"/);
  assert.match(layout, /postalCode: "06300"/);
  assert.match(layout, /addressLocality: "Nice"/);
  assert.match(layout, /normalizeFrenchPhone\(settings\.phone\)/);
});

test("French local phone numbers are normalized to international format", () => {
  assert.match(layout, /function normalizeFrenchPhone/);
  assert.match(layout, /return `\+33\$\{compact\.slice\(1\)\}`/);
  assert.match(layout, /"04 23 13 05 27"/);
  assert.match(layout, /telephone: publicPhone/);
});

test("local business exposes a menu URL and food establishment fields", () => {
  assert.match(layout, /const menuUrl = `\$\{siteUrl\(\)\}\/#menu`/);
  assert.match(layout, /menu: menuUrl/);
  assert.match(layout, /priceRange: "€"/);
  assert.match(layout, /servesCuisine: \["Japanese", "Matcha", "Tea"\]/);
});

test("opening hours use explicit OpeningHoursSpecification for every day", () => {
  assert.match(layout, /function openingHoursSpecification/);
  assert.match(layout, /"@type": "OpeningHoursSpecification"/);
  assert.match(layout, /"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"/);
  assert.match(layout, /openingHoursSpecification: openingSpecs/);
});

test("structured data links official social profiles and website entity", () => {
  assert.match(layout, /instagramUrl\(settings\.instagram\)/);
  assert.match(layout, /https:\/\/www\.facebook\.com\/IchigoIchie06/);
  assert.match(layout, /sameAs,/);
  assert.match(layout, /alternateName: "Ichigo Ichie Matcha Nice"/);
});
