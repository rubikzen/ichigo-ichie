import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const media = readFileSync(resolve(root, "src/components/SiteMediaField.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("media library can search by filename without touching upload logic", () => {
  assert.match(media, /const \[searchQuery, setSearchQuery\] = useState\(""\)/);
  assert.match(media, /item\.name\.toLocaleLowerCase\("fr"\)\.includes\(query\)/);
  assert.match(media, /placeholder="Rechercher un média…"/);
  assert.match(media, /visibleItems\.length} \/ \{items\.length/);
});

test("media library can sort by recent oldest or name", () => {
  assert.match(media, /"recent" \| "oldest" \| "name"/);
  assert.match(media, /value="recent">Plus récent/);
  assert.match(media, /value="oldest">Plus ancien/);
  assert.match(media, /value="name">Nom/);
  assert.match(media, /localeCompare\(b\.name, "fr"/);
});

test("media preview opens in an accessible dialog and closes with Escape", () => {
  assert.match(media, /const \[previewItem, setPreviewItem\] = useState<MediaItem \| null>\(null\)/);
  assert.match(media, /role="dialog"/);
  assert.match(media, /aria-modal="true"/);
  assert.match(media, /if \(event\.key === "Escape"\) setPreviewItem\(null\)/);
  assert.match(media, /Ouvrir l’image ↗/);
});

test("v384 media UX is responsive and preserves the v383 bulk uploader", () => {
  assert.match(media, /async function uploadMany\(files\?: FileList \| null\)/);
  assert.match(media, /multiple/);
  assert.match(css, /Ichigo Ichie V3\.84 — Media library search, sort and preview/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /media-preview-modal-v384/);
});
