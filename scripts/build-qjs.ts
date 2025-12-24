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

const qjscExists = await $`command -v qjsc`.quiet().nothrow();
if (qjscExists.exitCode === 0) {
  console.log("\nCompiling to native binary...");
  await $`qjsc -m -o ${join(BIN_DIR, "fjsf-qjs")} ${join(OUT_DIR, "cli.js")}`;
  console.log(`Binary created at bin/fjsf-qjs`);
  await $`ls -lh ${join(BIN_DIR, "fjsf-qjs")}`;
} else {
  console.log("\nNote: qjsc not found. Install QuickJS to compile native binary:");
  console.log("  brew install quickjs");
}
