import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const chrome = src("src/components/SiteChrome.tsx");
const retraitLayout = src("src/app/retrait/layout.tsx");

test("V447 treats the pickup staff route as a standalone internal app", () => {
  assert.ok(chrome.includes('pathname === "/retrait"'));
  assert.ok(chrome.includes('pathname.startsWith("/retrait/")'));
  assert.ok(chrome.includes("const isStandaloneApp = isAdmin || isPickupStaff"));
});

test("standalone admin and pickup apps render children without public site chrome", () => {
  const standaloneStart = chrome.indexOf("if (isStandaloneApp)");
  const publicStart = chrome.indexOf("return (", standaloneStart);

  assert.ok(standaloneStart >= 0);
  assert.ok(publicStart > standaloneStart);

  const standaloneBlock = chrome.slice(standaloneStart, publicStart);
  assert.ok(standaloneBlock.includes("return <main>{children}</main>"));
  assert.equal(standaloneBlock.includes("<SiteHeader"), false);
  assert.equal(standaloneBlock.includes("<SiteFooter"), false);
});

test("public storefront routes still keep the normal header and footer", () => {
  assert.ok(chrome.includes("<SiteHeader />"));
  assert.ok(chrome.includes("<SiteFooter />"));
  assert.ok(chrome.includes("<main>{children}</main>"));
});

test("V447 preserves the existing admin standalone behavior", () => {
  assert.ok(chrome.includes('pathname === "/admin"'));
  assert.ok(chrome.includes('pathname.startsWith("/admin/")'));
  assert.ok(chrome.includes("isAdmin || isPickupStaff"));
});

test("pickup staff route remains private and non-indexable", () => {
  assert.ok(retraitLayout.includes("index: false"));
  assert.ok(retraitLayout.includes("follow: false"));
  assert.ok(retraitLayout.includes("nocache: true"));
});
