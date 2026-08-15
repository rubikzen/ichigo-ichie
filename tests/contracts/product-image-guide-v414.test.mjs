import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const gallery = readFileSync(resolve(root, "src/components/ProductGalleryAdmin.tsx"), "utf8");
const catalog = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");

test("admin product gallery documents the new Boutique image standard", () => {
  assert.match(gallery, /shop:\s*\{[\s\S]*width:\s*800,[\s\S]*height:\s*1000,[\s\S]*ratio:\s*4 \/ 5/);
  assert.match(gallery, /ratioLabel:\s*"4:5"/);
  assert.match(gallery, /Boutique · Matcha & accessoires/);
});

test("admin product gallery documents a separate menu image standard", () => {
  assert.match(gallery, /menu:\s*\{[\s\S]*width:\s*1200,[\s\S]*height:\s*900,[\s\S]*ratio:\s*4 \/ 3/);
  assert.match(gallery, /ratioLabel:\s*"4:3"/);
  assert.match(gallery, /La carte · Boissons & desserts/);
});

test("visible guide and empty upload slots use the active catalog dimensions", () => {
  assert.match(gallery, /Format recommandé/);
  assert.match(gallery, /\{imageGuide\.width\} × \{imageGuide\.height\} px/);
  assert.match(gallery, /\{imageGuide\.ratioLabel\}/);
  assert.match(gallery, /WebP conseillé/);
});

test("upload dimension feedback validates against the same dynamic guide", () => {
  assert.match(gallery, /Math\.abs\(ratio - imageGuide\.ratio\) \/ imageGuide\.ratio/);
  assert.match(gallery, /ratio différent du \$\{imageGuide\.ratioLabel\} recommandé/);
  assert.match(
    catalog,
    /catalogKind=\{categoryById\.get\(productDraft\.category_id\)\?\.kind \?\? catalogZone\}/,
  );
  assert.doesNotMatch(gallery, /PRODUCT_TARGET_RATIO = 6 \/ 5/);
});
