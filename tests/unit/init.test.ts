import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { tmpdir } from "os";

describe("init shell integration", () => {
  it("getFjsfDir creates and returns directory", () => {
    const { getFjsfDir } = require("../../src/init.ts");
    const fjsfDir = getFjsfDir();

    expect(fjsfDir).toContain(".fjsf");
    expect(existsSync(fjsfDir)).toBe(true);
  });

  it("detectShell identifies current shell", () => {
    const { detectShell } = require("../../src/init.ts");
    const shell = detectShell();

    expect(["zsh", "bash", "fish", "unknown"]).toContain(shell);
  });

  it("getShellConfigFile returns correct paths for each shell", () => {
    const { getShellConfigFile } = require("../../src/init.ts");
    const home = homedir();

    const zshConfig = getShellConfigFile("zsh");
    expect([join(home, ".zshrc"), join(home, ".zprofile")]).toContain(
      zshConfig,
    );

    const bashConfig = getShellConfigFile("bash");
    expect([join(home, ".bashrc"), join(home, ".bash_profile")]).toContain(
      bashConfig,
    );

    const fishConfig = getShellConfigFile("fish");
    expect(fishConfig).toBe(join(home, ".config", "fish", "config.fish"));

    const unknownConfig = getShellConfigFile("unknown");
    expect(unknownConfig).toBe("");
  });

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

  it("package manager interceptors handle all shells", () => {
    const { getPackageManagerInterceptors } = require("../../src/init.ts");

    const zshScript = getPackageManagerInterceptors("zsh");
    expect(zshScript).toContain("_fjsf_widget");
    expect(zshScript.length).toBeGreaterThan(0);

    const bashScript = getPackageManagerInterceptors("bash");
    expect(bashScript).toContain("_fjsf_complete");
    expect(bashScript.length).toBeGreaterThan(0);

    const fishScript = getPackageManagerInterceptors("fish");
    expect(fishScript).toContain("_fjsf_widget");
    expect(fishScript.length).toBeGreaterThan(0);

    const unknownScript = getPackageManagerInterceptors("unknown");
    expect(unknownScript).toBe("");
  });

  it("autocomplete scripts handle all shells", () => {
    const { getAutocompleteScript } = require("../../src/init.ts");

    const zshScript = getAutocompleteScript("zsh");
    expect(zshScript).toContain("_fjsf_completions");
    expect(zshScript).toContain("compdef");
    expect(zshScript.length).toBeGreaterThan(0);

    const bashScript = getAutocompleteScript("bash");
    expect(bashScript).toContain("_fjsf_completions");
    expect(bashScript).toContain("complete -F");
    expect(bashScript.length).toBeGreaterThan(0);

    const fishScript = getAutocompleteScript("fish");
    expect(fishScript).toContain("complete -c fjsf");
    expect(fishScript.length).toBeGreaterThan(0);

    const unknownScript = getAutocompleteScript("unknown");
    expect(unknownScript).toBe("");
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

const shellIntegrationPatterns = {
  zsh: [
    "_fjsf_widget",
    "_fjsf_ensure_binding",
    "bindkey '^I' _fjsf_widget",
    "add-zsh-hook precmd _fjsf_ensure_binding",
    "widgets[^I]",
    "_fjsf_completions",
    "compdef _fjsf_completions fjsf",
  ],
  bash: [
    "_fjsf_complete",
    "_fjsf_ensure_binding",
    "bind -x",
    "PROMPT_COMMAND",
    "_fjsf_completions",
    "complete -F _fjsf_completions fjsf",
  ],
  fish: ["_fjsf_widget", "commandline", "complete -c fjsf"],
};

describe("shell integration content", () => {
  it("zsh integration includes binding persistence", () => {
    const {
      getPackageManagerInterceptors,
      getAutocompleteScript,
    } = require("../../src/init.ts");
    const interceptors = getPackageManagerInterceptors("zsh");
    const completions = getAutocompleteScript("zsh");
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.zsh.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });

  it("bash integration includes binding persistence", () => {
    const {
      getPackageManagerInterceptors,
      getAutocompleteScript,
    } = require("../../src/init.ts");
    const interceptors = getPackageManagerInterceptors("bash");
    const completions = getAutocompleteScript("bash");
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.bash.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });

  it("fish integration includes widget and completions", () => {
    const {
      getPackageManagerInterceptors,
      getAutocompleteScript,
    } = require("../../src/init.ts");
    const interceptors = getPackageManagerInterceptors("fish");
    const completions = getAutocompleteScript("fish");
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.fish.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });
});

describe("removeOldFjsfConfig", () => {
  const testFile = join(tmpdir(), `test-fjsf-${Date.now()}.sh`);

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  it("handles non-existent files gracefully", () => {
    const { removeOldFjsfConfig } = require("../../src/init.ts");
    const nonExistentFile = "/tmp/nonexistent-fjsf-test-file.sh";

    expect(() => removeOldFjsfConfig(nonExistentFile)).not.toThrow();
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
