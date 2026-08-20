import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const content = readFileSync(
  resolve(process.cwd(), "src/lib/product-content.ts"),
  "utf8",
);

test("V452.1 scopes matcha-specific metadata requirements to Boutique product type", () => {
  assert.match(
    content,
    /if \(product\.kind === "shop"\) \{\s+if \(product\.type === "product"\) \{/,
  );
});

test("V452.1 keeps origin ideal-for and rich French copy requirements for matcha products", () => {
  assert.match(
    content,
    /if \(product\.type === "product"\) \{[\s\S]*origin_missing[\s\S]*ideal_for_missing[\s\S]*long_fr_missing/,
  );
});

test("V452.1 does not make accessories invent matcha origin or ideal-for metadata", () => {
  const shopBlock = content.match(
    /if \(product\.kind === "shop"\) \{[\s\S]*?return issues;/,
  )?.[0] ?? "";
  assert.match(shopBlock, /if \(product\.type === "product"\)/);
  assert.doesNotMatch(shopBlock, /product\.type === "accessory"/);
  assert.doesNotMatch(shopBlock, /product\.type !== "accessory"/);
});

test("V452.1 still cleans malformed ideal-for values when such values exist", () => {
  assert.match(content, /ideal_for_cleanup/);
  assert.match(
    content,
    /\(product\.ideal_for \?\? \[\]\)\.length !== idealFor\.length/,
  );
});
