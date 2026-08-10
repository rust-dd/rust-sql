#!/usr/bin/env node
/**
 * The release version lives in three files that must agree; the git history
 * shows them drifting apart more than once. Run this in CI and as the first
 * step of a release.
 *
 * With --set <version> it writes that version to all three instead of checking.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const sources = [
  {
    path: "package.json",
    read: (text) => JSON.parse(text).version,
    write: (text, version) => text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`),
  },
  {
    path: "src-tauri/tauri.conf.json",
    read: (text) => JSON.parse(text).version,
    write: (text, version) => text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`),
  },
  {
    path: "src-tauri/Cargo.toml",
    read: (text) => text.match(/^version\s*=\s*"([^"]+)"/m)?.[1],
    write: (text, version) => text.replace(/^(version\s*=\s*)"[^"]*"/m, `$1"${version}"`),
  },
];

const setIndex = process.argv.indexOf("--set");
const target = setIndex === -1 ? null : process.argv[setIndex + 1];

if (setIndex !== -1 && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(target ?? "")) {
  console.error(`Not a valid semver version: ${target ?? "(missing)"}`);
  process.exit(1);
}

if (target) {
  for (const source of sources) {
    const file = join(root, source.path);
    writeFileSync(file, source.write(readFileSync(file, "utf8"), target));
    console.log(`${source.path} -> ${target}`);
  }
  process.exit(0);
}

const found = sources.map((source) => ({
  path: source.path,
  version: source.read(readFileSync(join(root, source.path), "utf8")),
}));

const missing = found.filter((entry) => !entry.version);
if (missing.length > 0) {
  for (const entry of missing) console.error(`No version found in ${entry.path}`);
  process.exit(1);
}

const distinct = [...new Set(found.map((entry) => entry.version))];
if (distinct.length > 1) {
  console.error("Version mismatch:");
  for (const entry of found) console.error(`  ${entry.path}: ${entry.version}`);
  console.error("\nRun `node scripts/check-version.mjs --set <version>` to align them.");
  process.exit(1);
}

console.log(`Version ${distinct[0]} is consistent across all three files.`);
