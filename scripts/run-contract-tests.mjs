import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const contractsDir = resolve(root, "tests/contracts");
const files = readdirSync(contractsDir)
  .filter((file) => file.endsWith(".test.mjs"))
  .sort();

const ranges = [
  ["A-C", /^[a-c]/i],
  ["D-F", /^[d-f]/i],
  ["G-I", /^[g-i]/i],
  ["J-L", /^[j-l]/i],
  ["M-O", /^[m-o]/i],
  ["P-R", /^[p-r]/i],
  ["S-U", /^[s-u]/i],
  ["V-Z", /^[v-z]/i],
];

const assigned = new Set();

for (const [label, pattern] of ranges) {
  const group = files.filter((file) => pattern.test(file));
  if (!group.length) continue;
  group.forEach((file) => assigned.add(file));

  console.log(`\n[contracts ${label}] ${group.length} files`);
  const result = spawnSync(
    process.execPath,
    ["--test", ...group.map((file) => resolve(contractsDir, file))],
    { cwd: root, stdio: "inherit" },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const fallback = files.filter((file) => !assigned.has(file));
if (fallback.length) {
  console.log(`\n[contracts other] ${fallback.length} files`);
  const result = spawnSync(
    process.execPath,
    ["--test", ...fallback.map((file) => resolve(contractsDir, file))],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nContract suite passed: ${files.length} files.`);
