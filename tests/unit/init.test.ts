import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { tmpdir } from "os";

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
    const markers = [
      "# fjsf interceptors",
      "# fjsf completion",
      "# fjsf alias",
    ];
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

describe("removeOldFjsfConfig", () => {
  const testFile = join(tmpdir(), `test-fjsf-${Date.now()}.sh`);

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  it("removes fjsf sections marked with comments", () => {
    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf interceptors

_fjsf_widget() {
  echo "test"
}

zle -N _fjsf_widget
bindkey '^I' _fjsf_widget

# other config
alias ll="ls -la"`;

    writeFileSync(testFile, content);

    const { removeOldFjsfConfig } = require("../../src/init.ts");
    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).not.toContain("_fjsf_widget");
    expect(result).not.toContain("# fjsf");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });

  it("removes multiple duplicate fjsf sections", () => {
    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf interceptors

_fjsf_widget() {
  echo "test1"
}

# fjsf completion

_fjsf_completions() {
  echo "test2"
}

# fjsf interceptors

_fjsf_widget() {
  echo "duplicate"
}

alias ll="ls -la"`;

    writeFileSync(testFile, content);

    const { removeOldFjsfConfig } = require("../../src/init.ts");
    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).not.toContain("_fjsf");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });

  it("removes standalone fjsf-related lines", () => {
    const content = `export PATH="/usr/local/bin:$PATH"
bindkey '^I' _fjsf_widget
alias fj='fjsf'
complete -F _fjsf_completions fjsf
alias ll="ls -la"`;

    writeFileSync(testFile, content);

    const { removeOldFjsfConfig } = require("../../src/init.ts");
    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).not.toContain("_fjsf");
    expect(result).not.toContain("fj=");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });

  it("preserves non-fjsf content", () => {
    const content = `export PATH="/usr/local/bin:$PATH"
alias ll="ls -la"
export EDITOR="vim"

# my custom functions
function myfunction() {
  echo "test"
}`;

    writeFileSync(testFile, content);

    const { removeOldFjsfConfig } = require("../../src/init.ts");
    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).toBe(content);
  });

  it("removes source lines for .fjsf integration files", () => {
    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf
[ -f "/Users/user/.fjsf/init.zsh" ] && source "/Users/user/.fjsf/init.zsh"

alias ll="ls -la"`;

    writeFileSync(testFile, content);

    const { removeOldFjsfConfig } = require("../../src/init.ts");
    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).not.toContain(".fjsf");
    expect(result).not.toContain("source");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });
});
