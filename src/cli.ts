#!/usr/bin/env bun

import { run } from "./app.ts";
import { runJsonApp } from "./json/app.ts";
import { parseCliArgs, getModeTitle } from "./modes.ts";

const args = process.argv.slice(2);
const config = parseCliArgs(args);

const isJsonMode = config.mode === "json";
const isCustomMode = config.mode === "custom";
const shouldRunJsonApp = isJsonMode || isCustomMode;

if (shouldRunJsonApp) {
  const title = getModeTitle(config);
  runJsonApp(config, title);
} else {
  run();
}
