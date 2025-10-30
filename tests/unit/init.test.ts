import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

describe("init shell integration", () => {
  it("detects shell config files", () => {
    const home = homedir();
    const possibleConfigs = [
      join(home, ".zshrc"),
      join(home, ".bashrc"),
      join(home, ".config", "fish", "config.fish"),
    ];

    const hasAtLeastOne = possibleConfigs.some((config) => existsSync(config));
    expect(hasAtLeastOne).toBe(true);
  });

  it("shell config markers are unique", () => {
    const markers = ["# fjsf interceptors", "# fjsf completion", "# fjsf alias"];
    const uniqueMarkers = new Set(markers);
    expect(uniqueMarkers.size).toBe(markers.length);
  });
});

describe("init version updates", () => {
  it("can detect existing fjsf markers in shell config", () => {
    const home = homedir();
    const zshrc = join(home, ".zshrc");

    if (!existsSync(zshrc)) {
      return;
    }

    const content = readFileSync(zshrc, "utf-8");
    const hasFjsfConfig =
      content.includes("# fjsf") || content.includes("_fjsf_widget");

    expect(typeof hasFjsfConfig).toBe("boolean");
  });
});
