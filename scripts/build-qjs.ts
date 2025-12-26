#!/usr/bin/env bun
import { $ } from "bun";
import { join, dirname } from "path";
import { mkdirSync } from "fs";

const ROOT_DIR = dirname(import.meta.dir);
const OUT_DIR = join(ROOT_DIR, "dist");
const SRC_DIR = join(ROOT_DIR, "src");
const BIN_DIR = join(ROOT_DIR, "bin");

const pkg = await Bun.file(join(ROOT_DIR, "package.json")).json();
const VERSION = pkg.version;

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(BIN_DIR, { recursive: true });

console.log(`Building QuickJS bundle (v${VERSION})...`);

await $`bun build ${join(SRC_DIR, "cli.ts")} --outfile ${join(OUT_DIR, "cli.js")} --target browser --format esm --packages external --minify`;

const cliPath = join(OUT_DIR, "cli.js");
const cliContent = await Bun.file(cliPath).text();
await Bun.write(cliPath, cliContent.replace(/__VERSION__/g, VERSION));

console.log(`Bundle created at ${OUT_DIR}/cli.js (v${VERSION})`);

const findQjsc = async (): Promise<string | null> => {
  const inPath = await $`command -v qjsc`.quiet().nothrow();
  if (inPath.exitCode === 0) {
    return inPath.text().trim();
  }

  const locations = [
    `${process.env.HOME}/.local/bin/qjsc`,
    "/usr/local/bin/qjsc",
  ];

  const results = await Promise.all(
    locations.map(async (loc) => {
      const exists = await $`test -x ${loc}`.quiet().nothrow();
      return exists.exitCode === 0 ? loc : null;
    }),
  );

  return results.find((loc) => loc !== null) ?? null;
};

const qjscPath = await findQjsc();
if (!qjscPath) {
  console.error(
    "\nError: qjsc not found. Install QuickJS to compile native binary:",
  );
  console.error("  macOS: brew install quickjs");
  console.error(
    "  Linux: git clone https://github.com/quickjs-ng/quickjs.git && cd quickjs && cmake -B build && cmake --build build && sudo cmake --install build",
  );
  process.exit(1);
}

console.log(`Found qjsc at: ${qjscPath}`);

console.log("\nCompiling to native binary...");
await $`${qjscPath} -m -o ${join(BIN_DIR, "fjsf-qjs")} ${join(OUT_DIR, "cli.js")}`;
await $`chmod +x ${join(BIN_DIR, "fjsf-qjs")}`;
console.log(`Binary created at bin/fjsf-qjs`);
await $`ls -lh ${join(BIN_DIR, "fjsf-qjs")}`;
await $`file ${join(BIN_DIR, "fjsf-qjs")}`;
