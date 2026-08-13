import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const card = readFileSync(resolve(root, "src/components/MenuInfoCard.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

function ruleBody(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `missing CSS selector: ${selector}`);

  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  assert.notEqual(open, -1, `missing opening brace for ${selector}`);
  assert.notEqual(close, -1, `missing closing brace for ${selector}`);

  return css.slice(open + 1, close);
}

test("menu badges receive a size class based on text length", () => {
  assert.match(card, /function badgeLengthClass\(value: string\)/);
  assert.match(card, /length <= 8/);
  assert.match(card, /length <= 12/);
  assert.match(card, /length <= 16/);
  assert.match(card, /badge-xlong-v385/);
});

test("menu badge markup applies the dynamic size class", () => {
  assert.ok(
    card.includes('className={`menu-info-badge ${badgeLengthClass(product.badge)}`}'),
    "menu badge should include the dynamic length class",
  );
});

test("longer badges reduce typography without increasing badge dimensions", () => {
  const expected = {
    short: "font-size: 10px",
    medium: "font-size: 9.2px",
    long: "font-size: 8.4px",
    xlong: "font-size: 7.7px",
  };

  for (const [size, fontSize] of Object.entries(expected)) {
    const body = ruleBody(`.menu-info-badge.badge-${size}-v385`);
    assert.ok(body.includes(fontSize), `${size} badge should use ${fontSize}`);
    assert.ok(!body.includes("height:"), `${size} badge must not redefine height`);
    assert.ok(!body.includes("max-width:"), `${size} badge must not redefine max-width`);
    assert.ok(!body.includes("padding:"), `${size} badge must not redefine padding`);
    assert.ok(!body.includes("padding-inline:"), `${size} badge must not redefine padding-inline`);
  }
});

test("dynamic badge typography also scales down on mobile", () => {
  assert.ok(css.includes("@media (max-width: 720px)"));
  assert.ok(css.includes("font-size: 8.3px"));
  assert.ok(css.includes("font-size: 7.6px"));
  assert.ok(css.includes("font-size: 7px"));
});


test("menu badges keep one fixed footprint so long labels cannot widen the pill", () => {
  assert.match(css, /Ichigo Ichie V3\.85a — Fixed badge footprint/);
  assert.match(css, /\.menu-info-badge\s*\{[\s\S]*?width:\s*108px;[\s\S]*?max-width:\s*108px;/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.menu-info-badge\s*\{[\s\S]*?width:\s*96px;[\s\S]*?max-width:\s*96px;/);
});
