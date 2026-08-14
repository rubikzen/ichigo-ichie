import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

const media = readFileSync(
  resolve(root, "src/components/SiteMediaField.tsx"),
  "utf8",
);
const css22 = readFileSync(
  resolve(root, "src/app/styles/globals-02.css"),
  "utf8",
);
const css384 = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8",
);

test("site media field uses SafeImage for every rendered media image", () => {
  assert.match(media, /import \{ SafeImage \} from "\.\/SafeImage";/);
  assert.equal((media.match(/<SafeImage\b/g) ?? []).length, 4);
  assert.doesNotMatch(media, /<img\b/);
});

test("selected CMS preview keeps the existing slot-aware crop frame", () => {
  assert.match(
    media,
    /className="site-media-preview" style=\{\{ position: "relative" \}\}/,
  );
  assert.match(
    media,
    /<SafeImage[\s\S]*?src=\{value\}[\s\S]*?\sfill[\s\S]*?slot === "logo" \? "260px"/,
  );
  assert.match(
    css22,
    /site-media-field\[data-media-slot=\\?"logo\\?"\][\s\S]*?site-media-preview img\{object-fit:contain;padding:14px\}/,
  );
  assert.match(
    css22,
    /site-media-field\[data-media-slot=\\?"hero\\?"\][\s\S]*?site-media-preview img,[\s\S]*?story[\s\S]*?object-fit:cover/,
  );
});

test("inline and manager library thumbnails preserve responsive media presentation", () => {
  assert.match(
    media,
    /<SafeImage src=\{item\.url\} alt="" width=\{500\} height=\{400\}/,
  );
  assert.match(
    media,
    /width=\{1200\}[\s\S]*?height=\{900\}[\s\S]*?style=\{\{ width: "100%", height: "auto" \}\}/,
  );
  assert.match(css22, /site-media-grid img\{display:block;width:100%;aspect-ratio:1\.25;object-fit:cover\}/);
  assert.match(css384, /media-library-preview-button-v384 img[\s\S]*?width: 100%/);
});

test("full media preview remains contained and keeps the existing accessible modal", () => {
  assert.match(media, /role="dialog"/);
  assert.match(media, /aria-modal="true"/);
  assert.match(media, /if \(event\.key === "Escape"\) setPreviewItem\(null\)/);
  assert.match(
    media,
    /src=\{previewItem\.url\}[\s\S]*?width=\{2000\}[\s\S]*?objectFit: "contain"/,
  );
  assert.match(css384, /media-preview-stage-v384 img[\s\S]*?object-fit: contain/);
});
