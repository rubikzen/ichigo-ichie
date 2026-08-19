import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
const header = readFileSync(resolve(process.cwd(), "src/components/SiteHeader.tsx"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/app/styles/globals-04.css"), "utf8");
test("V449.2b removes 118px ellipsis source", () => {
  assert.equal(header.includes("max-width: 118px;"), false);
  assert.equal(header.includes("text-overflow: ellipsis;"), false);
});
test("V449.2b removes 94px narrow cap", () => {
  assert.equal(header.includes("max-width: 94px;"), false);
  assert.ok(header.includes("max-width: none;"));
});
test("V449.2b guarantees full sticky wordmark", () => {
  assert.ok(css.includes("/* Ichigo Ichie V4.49.2b — Sticky header wordmark fix */"));
  assert.ok(css.includes("min-width: max-content !important;"));
  assert.ok(css.includes("text-overflow: clip !important;"));
});
test("V449.2b keeps mobile controls intact", () => {
  assert.ok(header.includes("language-switch-mobile-visible-v261"));
  assert.ok(header.includes("account-link-v243"));
});
