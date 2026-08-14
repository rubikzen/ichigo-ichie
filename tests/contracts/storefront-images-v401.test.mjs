import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const safeImage = readFileSync(
  resolve(root, "src/components/SafeImage.tsx"),
  "utf8",
);
const product = readFileSync(
  resolve(root, "src/components/ProductCard.tsx"),
  "utf8",
);
const home = readFileSync(
  resolve(root, "src/components/HomePageContent.tsx"),
  "utf8",
);
const header = readFileSync(
  resolve(root, "src/components/SiteHeader.tsx"),
  "utf8",
);

test("SafeImage optimizes local and Supabase media while preserving arbitrary CMS URLs", () => {
  assert.match(safeImage, /src\.startsWith\("\/"\)/);
  assert.match(safeImage, /url\.hostname\.endsWith\("\.supabase\.co"\)/);
  assert.match(safeImage, /loader=\{passthroughLoader\} unoptimized/);
  assert.match(safeImage, /src=\{src\} alt=\{alt\}/);
  assert.match(safeImage, /return <Image \{\.\.\.props\} src=\{src\} alt=\{alt\} \/>;/);
});

test("ProductCard storefront images use SafeImage with responsive sizing", () => {
  assert.match(product, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.match(product, /<SafeImage\s+src=\{image\}[\s\S]*?\sfill\s+sizes=/);
  assert.match(product, /<SafeImage src=\{url\} alt="" width=\{240\} height=\{180\}/);
  assert.match(product, /className="product-image"[\s\S]*?width=\{800\}[\s\S]*?height=\{656\}/);
  assert.doesNotMatch(product, /<img\b/);
});

test("homepage story media uses SafeImage without changing the existing hero Image", () => {
  assert.match(home, /import Image from "next\/image";/);
  assert.match(home, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.match(home, /src=\{settings\.home_hero_image_url \|\| "\/products\/matcha-coconut-cloud\.webp"\}/);
  assert.match(home, /<SafeImage\s+src=\{settings\.story_image_url\}[\s\S]*?\sfill\s+sizes=/);
  assert.match(home, /src=\{settings\.brand_logo_url\}[\s\S]*?width=\{86\}[\s\S]*?height=\{86\}/);
  assert.doesNotMatch(home, /<img\b/);
});

test("header logo uses SafeImage with fixed intrinsic dimensions and preload priority", () => {
  assert.match(header, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.match(
    header,
    /<SafeImage[\s\S]*?src=\{settings\.brand_logo_url \|\| "\/brand-mark\.svg"\}[\s\S]*?width=\{42\}[\s\S]*?height=\{42\}[\s\S]*?priority/,
  );
  assert.doesNotMatch(header, /<img\b/);
});
