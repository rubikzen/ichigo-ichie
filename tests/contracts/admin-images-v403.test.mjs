import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const gallery = readFileSync(
  resolve(root, "src/components/ProductGalleryAdmin.tsx"),
  "utf8",
);
const catalog = readFileSync(
  resolve(root, "src/components/admin/AdminCatalog.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(root, "src/app/styles/globals-01.css"),
  "utf8",
);

test("product gallery admin previews use SafeImage inside the existing fixed media stage", () => {
  assert.match(gallery, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.match(
    gallery,
    /<SafeImage[\s\S]*?src=\{image\.url\}[\s\S]*?alt=\{`\$\{productName\} \$\{index \+ 1\}`\}[\s\S]*?\sfill[\s\S]*?style=\{\{ objectFit: "cover" \}\}/,
  );
  assert.match(css, /\.gallery-admin-image\{height:155px;position:relative;background:var\(--soft\)\}/);
  assert.doesNotMatch(gallery, /<img/);
});

test("quick admin catalog thumbnails use SafeImage while existing CSS keeps their exact footprint", () => {
  assert.match(catalog, /import \{ SafeImage \} from "\.\.\/SafeImage";/);
  assert.match(
    catalog,
    /<SafeImage src=\{product\.image_url \|\| "\/product-placeholder\.svg"\} alt="" width=\{128\} height=\{128\} sizes="\(max-width: 1280px\) 58px, 64px" \/>/,
  );
  assert.match(
    css,
    /\.quick-product-image img\{width:64px;height:64px;object-fit:cover;border-radius:13px;/,
  );
  assert.match(
    css,
    /@media\(max-width:1280px\)\{[\s\S]*?\.quick-product-image img\{width:58px;height:58px\}/,
  );
  assert.doesNotMatch(catalog, /<img/);
});
