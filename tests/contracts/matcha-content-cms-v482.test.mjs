import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const admin = src("src/components/admin/AdminSettings.tsx");
const editor = src("src/components/admin/MatchaContentAdmin.tsx");
const index = src("src/lib/matcha-intent-index.ts");
const pages = src("src/lib/matcha-intent-pages.ts");
const nav = src("src/components/MatchaExploreNav.tsx");
const guideHub = src("src/components/MatchaGuidesIndexContent.tsx");
const server = src("src/components/MatchaIntentPageServer.tsx");
const settings = src("src/lib/settings.ts");
const css = src("src/app/styles/globals-04.css");

const routes = [
  ["src/app/matcha-usucha/page.tsx", "usucha"],
  ["src/app/matcha-koicha/page.tsx", "koicha"],
  ["src/app/matcha-latte/page.tsx", "latte"],
  ["src/app/matcha-ceremonie/page.tsx", "ceremonial"],
].map(([path, tag]) => ({ tag, source: src(path) }));

test("V482 adds Pages matcha inside Site content settings", () => {
  assert.match(admin, /import \{ MatchaContentAdmin \}/);
  assert.match(admin, /\{ id: "matcha", group: "Contenu", label: "Pages matcha"/);
  assert.match(admin, /<MatchaContentAdmin settings=\{settings\} setValue=\{set\} toggleValue=\{toggle\} \/>/);
  assert.match(editor, /data-matcha-content-admin-v482/);
});

test("V482 edits all four intent pages with static copy as fallback", () => {
  assert.match(editor, /MATCHA_INTENT_PAGES\.map/);
  assert.match(editor, /matchaIntentSettingPrefix\(page\.tag\)/);
  assert.match(editor, /page\.titleFr/);
  assert.match(editor, /page\.introFr/);
  assert.match(editor, /page\.selectionTitleFr/);
  assert.match(editor, /page\.metaTitleFr/);
});

test("V482 exposes bilingual rail hero selection and facts", () => {
  assert.match(editor, /matcha_explore_label/);
  assert.match(editor, /matcha_nav_shop_fr/);
  assert.match(editor, /matcha_nav_guides_en/);
  assert.match(editor, /`\$\{prefix\}_label`/);
  assert.match(editor, /`\$\{prefix\}_title`/);
  assert.match(editor, /`\$\{prefix\}_eyebrow`/);
  assert.match(editor, /`\$\{prefix\}_intro`/);
  assert.match(editor, /`\$\{prefix\}_facts`/);
  assert.match(editor, /`\$\{prefix\}_selection_title`/);
});

test("V482 makes editorial sections and FAQ human-editable", () => {
  assert.match(editor, /serializeMatchaIntentBody/);
  assert.match(editor, /serializeMatchaIntentFaq/);
  assert.match(editor, /## titre de section/);
  assert.match(editor, /Q: … puis A: …/);
  assert.match(pages, /function parseIntentBody/);
  assert.match(pages, /function parseIntentFaq/);
});

test("V482 overlays configured copy while retaining V470 static source", () => {
  assert.match(pages, /export const MATCHA_INTENT_PAGES/);
  assert.match(pages, /getConfiguredMatchaIntentPage/);
  assert.match(pages, /configureMatchaIntentSummary/);
  assert.match(pages, /mergeIntentSections/);
  assert.match(pages, /mergeIntentFaq/);
  assert.match(index, /configureMatchaIntentSummary/);
  assert.match(index, /matchaIntentVisible/);
});

test("V482 updates explore rail and guide hub from lightweight settings", () => {
  assert.match(nav, /useSiteSettings/);
  assert.match(nav, /MATCHA_INTENT_SUMMARIES\.map/);
  assert.match(nav, /configureMatchaIntentSummary/);
  assert.match(nav, /matchaIntentVisible/);
  assert.match(nav, /matcha_nav_shop_fr/);
  assert.match(nav, /matcha_explore_label_fr/);
  assert.match(guideHub, /useSiteSettings/);
  assert.match(guideHub, /MATCHA_INTENT_SUMMARIES\.map/);
  assert.match(guideHub, /matchaIntentVisible/);
});

test("V482 server and structured data use configured page copy", () => {
  assert.match(server, /getSiteSettings/);
  assert.match(server, /getConfiguredMatchaIntentPage\(tag, settings\)/);
  assert.match(server, /configureMatchaIntentSummary/);
  assert.match(server, /"@type": "CollectionPage"/);
  assert.match(server, /"@type": "FAQPage"/);
  assert.match(server, /page\.metaDescriptionFr/);
  assert.match(server, /page\.faq\.map/);
});

test("V482 metadata for all four routes comes from admin settings", () => {
  for (const { source, tag } of routes) {
    assert.match(source, /export async function generateMetadata/);
    assert.match(source, /const settings = await getSiteSettings\(\)/);
    assert.match(
      source,
      new RegExp(`getMatchaIntentMetadata\\("${tag}", settings\\)`),
    );
    assert.match(source, /revalidate = 30/);
  }
  assert.match(pages, /alternates: \{ canonical: page\.href \}/);
  assert.match(pages, /openGraph/);
  assert.match(pages, /twitter/);
});

test("V482 keeps long editorial values out of global client settings", () => {
  assert.match(settings, /matchaIntentHeavySettingKey/);
  assert.match(settings, /usucha\|koicha\|latte\|ceremonial/);
  assert.match(settings, /selection_title\|selection_intro\|body\|faq/);
  assert.match(settings, /!matchaIntentHeavySettingKey\.test\(key\)/);
});

test("V482 needs no migration and does not change product behavior", () => {
  assert.match(css, /V482 — Matcha content CMS/);
  assert.match(css, /@media \(max-width: 700px\)/);
  const combined = [editor, index, pages, nav, guideHub, server].join("\n");
  assert.doesNotMatch(combined, /addItem\(|setQuantity\(|removeItem\(/);
  assert.doesNotMatch(combined, /from\("products"\)\.(insert|update|delete)/);
  assert.doesNotMatch(combined, /supabase\/migrations/);
});
