#!/usr/bin/env node

const { execFileSync } = require("child_process");
const { join } = require("path");
const { platform, arch } = require("os");

const getBinaryName = () => {
  const os = platform();
  const cpu = arch();

  if (os === "darwin" && cpu === "arm64") {
    return "fjsf-qjs-darwin-arm64";
  }
  if (os === "darwin" && cpu === "x64") {
    return "fjsf-qjs-darwin-x64";
  }
  if (os === "linux" && cpu === "x64") {
    return "fjsf-qjs-linux-x64";
  }

  console.error(`Unsupported platform: ${os}-${cpu}`);
  console.error("Supported: darwin-arm64, darwin-x64, linux-x64");
  process.exit(1);
};

const binaryName = getBinaryName();
const binaryPath = join(__dirname, "..", "bin", binaryName);

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
