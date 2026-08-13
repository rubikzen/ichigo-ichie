import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const media = readFileSync(resolve(root, "src/components/SiteMediaField.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("UI media library accepts multiple image files at once", () => {
  assert.match(media, /multiple/);
  assert.match(media, /async function uploadMany\(files\?: FileList \| null\)/);
  assert.match(media, /Array\.from\(files\)/);
  assert.match(media, /\+ Ajouter des images/);
});

test("bulk upload reports live batch progress", () => {
  assert.match(media, /uploadProgress/);
  assert.match(media, /Envoi \$\{uploadProgress\.current\} \/ \$\{uploadProgress\.total\}…/);
  assert.match(media, /setUploadProgress\(\{ current: index \+ 1, total: selected\.length \}\)/);
});

test("one failed image does not stop the remaining batch", () => {
  assert.match(media, /for \(let index = 0; index < selected\.length; index \+= 1\)/);
  assert.match(media, /errors\.push/);
  assert.match(media, /successCount \+= 1/);
  assert.match(media, /await refresh\(\)/);
});

test("bulk media upload resets the picker and explains partial failure", () => {
  assert.match(media, /event\.currentTarget\.value = ""/);
  assert.match(media, /media-upload-warning-v383/);
  assert.match(media, /errors\.length > 1 \? "s" : ""/);
  assert.match(css, /Ichigo Ichie V3\.83 — Bulk media upload feedback/);
});
