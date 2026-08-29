import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src/app/styles/globals-04.css");
const fullOutputPath = resolve(root, "src/app/styles/globals-04.full.generated.css");
const storefrontOutputPath = resolve(root, "src/app/styles/globals-04.storefront.generated.css");

const ROUTE_ANCHORS = {
  admin: [/^admin-/i, /-admin(?:-|$)/i],
  customer: [/^customer-/i],
  checkout: [/^checkout-/i],
};

function splitTopLevelCss(source) {
  const units = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  let inComment = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth < 0) throw new Error(`V487 CSS parser: unexpected closing brace at ${index}`);
      if (depth === 0) {
        units.push(source.slice(start, index + 1));
        start = index + 1;
      }
      continue;
    }

    if (char === ";" && depth === 0) {
      units.push(source.slice(start, index + 1));
      start = index + 1;
    }
  }

  if (quote) throw new Error("V487 CSS parser: unterminated string");
  if (inComment) throw new Error("V487 CSS parser: unterminated comment");
  if (depth !== 0) throw new Error(`V487 CSS parser: unbalanced braces (${depth})`);
  if (start < source.length) units.push(source.slice(start));

  return units;
}

function stripComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function unitKey(unit) {
  return stripComments(unit).trim();
}

function classNames(value) {
  return [...value.matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]);
}

function selectorHeaders(unit) {
  const cleaned = stripComments(unit);
  const headers = [];
  const pattern = /(^|(?<=[{}]))\s*([^{}]+?)\s*\{/gm;

  for (const match of cleaned.matchAll(pattern)) {
    const header = match[2].trim();
    if (!header || header.startsWith("@")) continue;
    if (/^(?:from|to|\d+(?:\.\d+)?%)$/i.test(header)) continue;
    headers.push(header);
  }

  return headers;
}

function anchoredRoutesForSelector(selector) {
  const names = classNames(selector);
  const routes = new Set();

  for (const [route, anchors] of Object.entries(ROUTE_ANCHORS)) {
    if (names.some((name) => anchors.some((anchor) => anchor.test(name)))) routes.add(route);
  }

  return routes;
}

function routeForUnit(unit) {
  const headers = selectorHeaders(unit);
  if (!headers.length) return null;

  let candidates = new Set(Object.keys(ROUTE_ANCHORS));

  for (const header of headers) {
    // Commas inside :is() make this intentionally conservative: an ambiguous
    // selector remains in the storefront bundle rather than risking a visual regression.
    const selectors = header.split(",").map((selector) => selector.trim()).filter(Boolean);
    for (const selector of selectors) {
      const anchored = anchoredRoutesForSelector(selector);
      candidates = new Set([...candidates].filter((route) => anchored.has(route)));
      if (!candidates.size) return null;
    }
  }

  return candidates.size === 1 ? [...candidates][0] : null;
}

function writeAtomic(path, content) {
  const tempPath = `${path}.tmp`;
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, path);
}

const source = readFileSync(sourcePath, "utf8");
const units = splitTopLevelCss(source);
const lastOccurrence = new Map();

for (let index = 0; index < units.length; index += 1) {
  const key = unitKey(units[index]);
  if (key) lastOccurrence.set(key, index);
}

let duplicateUnits = 0;
const fullUnits = [];

for (let index = 0; index < units.length; index += 1) {
  const unit = units[index];
  const key = unitKey(unit);
  if (key && lastOccurrence.get(key) !== index) {
    duplicateUnits += 1;
    continue;
  }
  fullUnits.push(unit);
}

const extracted = {
  admin: { units: 0, bytes: 0 },
  customer: { units: 0, bytes: 0 },
  checkout: { units: 0, bytes: 0 },
};
const storefrontUnits = [];

for (const unit of fullUnits) {
  const route = routeForUnit(unit);
  if (route && extracted[route]) {
    extracted[route].units += 1;
    extracted[route].bytes += Buffer.byteLength(unit);
    continue;
  }
  storefrontUnits.push(unit);
}

const full = fullUnits.join("");
const storefront = storefrontUnits.join("");
const sourceBytes = Buffer.byteLength(source);
const fullBytes = Buffer.byteLength(full);
const storefrontBytes = Buffer.byteLength(storefront);
const duplicateSavedBytes = sourceBytes - fullBytes;
const routeSavedBytes = fullBytes - storefrontBytes;
const totalStorefrontSavedBytes = sourceBytes - storefrontBytes;

if (!full.trim() || !storefront.trim()) throw new Error("V487 CSS generation produced an empty stylesheet");
if (fullBytes > sourceBytes) throw new Error("V487 full CSS unexpectedly increased stylesheet size");
if (storefrontBytes > fullBytes) throw new Error("V487 storefront CSS unexpectedly exceeded full stylesheet size");

writeAtomic(fullOutputPath, full);
writeAtomic(storefrontOutputPath, storefront);

const totalSavedPercent = sourceBytes ? ((totalStorefrontSavedBytes / sourceBytes) * 100).toFixed(1) : "0.0";
console.log(
  `[V487 CSS] source=${sourceBytes}B full=${fullBytes}B storefront=${storefrontBytes}B ` +
  `duplicates=${duplicateUnits}/${duplicateSavedBytes}B routeExtracted=${routeSavedBytes}B ` +
  `(admin=${extracted.admin.units}/${extracted.admin.bytes}B customer=${extracted.customer.units}/${extracted.customer.bytes}B ` +
  `checkout=${extracted.checkout.units}/${extracted.checkout.bytes}B) ` +
  `savedFromStorefront=${totalStorefrontSavedBytes}B (${totalSavedPercent}%)`,
);
