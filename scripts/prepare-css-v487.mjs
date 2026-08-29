import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "src/app/styles/globals-04.css");
const outputPath = resolve(root, "src/app/styles/globals-04.generated.css");
const tempPath = `${outputPath}.tmp`;

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

function unitKey(unit) {
  return unit.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

const source = readFileSync(sourcePath, "utf8");
const units = splitTopLevelCss(source);
const lastOccurrence = new Map();

for (let index = 0; index < units.length; index += 1) {
  const key = unitKey(units[index]);
  if (key) lastOccurrence.set(key, index);
}

let removedUnits = 0;
let removedBytes = 0;
const kept = [];

for (let index = 0; index < units.length; index += 1) {
  const unit = units[index];
  const key = unitKey(unit);
  if (key && lastOccurrence.get(key) !== index) {
    removedUnits += 1;
    removedBytes += Buffer.byteLength(unit);
    continue;
  }
  kept.push(unit);
}

const generated = kept.join("");
const sourceBytes = Buffer.byteLength(source);
const generatedBytes = Buffer.byteLength(generated);

if (!generated.trim()) throw new Error("V487 CSS generation produced an empty stylesheet");
if (generatedBytes > sourceBytes) throw new Error("V487 CSS generation unexpectedly increased stylesheet size");

writeFileSync(tempPath, generated, "utf8");
renameSync(tempPath, outputPath);

const savedPercent = sourceBytes ? ((removedBytes / sourceBytes) * 100).toFixed(1) : "0.0";
console.log(
  `[V487 CSS] source=${sourceBytes}B generated=${generatedBytes}B removed=${removedUnits} duplicate top-level blocks saved=${removedBytes}B (${savedPercent}%)`,
);
