#!/usr/bin/env node

import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { platform, arch } from "os";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = join(__dirname, "..", "bin");

const PLATFORM_BINARIES = {
  "darwin-arm64": "fjsf-qjs-darwin-arm64",
  "linux-x64": "fjsf-qjs-linux-x64",
};

const getBinaryPath = () => {
  const key = `${platform()}-${arch()}`;
  const platformBinary = PLATFORM_BINARIES[key];

  if (platformBinary) {
    const platformPath = join(binDir, platformBinary);
    if (existsSync(platformPath)) return platformPath;
  }

  const genericPath = join(binDir, "fjsf-qjs");
  if (existsSync(genericPath)) return genericPath;

  console.error(`No binary found for platform: ${key}`);
  console.error("Supported: darwin-arm64, linux-x64");
  process.exit(1);
};

const binaryPath = getBinaryPath();

try {
  execFileSync(binaryPath, process.argv.slice(2), {
    stdio: "inherit",
  });
} catch (error) {
  if (error.status !== undefined) {
    process.exit(error.status);
  }
  throw error;
}
