import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const content = readFileSync(
  resolve(process.cwd(), "src/lib/product-content.ts"),
  "utf8",
);

test("V451.1 recognizes French copy intentionally reused as an English fallback", () => {
  assert.match(content, /function isEditorialFallbackCopy/);
  assert.match(content, /normalizeEditorialText\(candidate\) === value/);
});

test("V451.1 does not flag short EN when it is exactly the FR fallback", () => {
  assert.match(
    content,
    /!isEditorialFallbackCopy\(shortEn, \[shortFr\]\)/,
  );
});

test("V451.1 does not flag long EN when it matches an allowed FR or short-copy fallback", () => {
  assert.match(
    content,
    /!isEditorialFallbackCopy\(longEn, \[longFr, shortFr, shortEn\]\)/,
  );
});

test("V451.1 still keeps genuine FR-in-EN warnings for non-fallback copy", () => {
  assert.match(content, /short_en_likely_fr/);
  assert.match(content, /long_en_likely_fr/);
  assert.match(content, /detectEditorialLanguage\(shortEn\) === "fr"/);
  assert.match(content, /detectEditorialLanguage\(longEn\) === "fr"/);
});
