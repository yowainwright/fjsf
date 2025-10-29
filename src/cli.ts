#!/usr/bin/env bun

import { run } from "./app.ts";
import { runJsonApp } from "./json/app.ts";
import { executeKey } from "./executor.ts";
import { parseCliArgs, getModeTitle, showHelp } from "./modes.ts";

const args = process.argv.slice(2);
const config = parseCliArgs(args);

const isHelpMode = config.mode === "help";
if (isHelpMode) {
  showHelp();
  process.exit(0);
}

const isQuitMode = config.mode === "quit";
if (isQuitMode) {
  process.exit(0);
}

const isExecMode = config.mode === "exec";
if (isExecMode) {
  await executeKey(config);
  process.exit(0);
}

const isFindMode = config.mode === "find";
const isPathMode = config.mode === "path";
const shouldRunJsonApp = isFindMode || isPathMode;

if (shouldRunJsonApp) {
  const title = getModeTitle(config);
  runJsonApp(config, title);
} else {
  run(config);
}
