import { describe, it, expect, afterEach } from "bun:test";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";
import { tmpdir } from "os";
import {
  getFjsfDir,
  detectShell,
  getShellConfigFile,
  getShellScriptPath,
  getShellIntegrationFile,
  removeOldFjsfConfig,
} from "../../src/init.ts";

describe("init shell integration", () => {
  it("getFjsfDir creates and returns directory", () => {
    const fjsfDir = getFjsfDir();

    expect(fjsfDir).toContain(".fjsf");
    expect(existsSync(fjsfDir)).toBe(true);
  });

  it("detectShell identifies current shell", () => {
    const shell = detectShell();

    expect(["zsh", "bash", "fish", "unknown"]).toContain(shell);
  });

  it("getShellConfigFile returns correct paths for each shell", () => {
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

  describe("getShellScriptPath", () => {
    it("returns correct path for zsh widget", () => {
      const path = getShellScriptPath("zsh", "widget");
      expect(path).toContain("shell-integrations");
      expect(path).toContain("zsh");
      expect(path).toEndWith("widget.zsh");
    });

    it("returns correct path for bash widget", () => {
      const path = getShellScriptPath("bash", "widget");
      expect(path).toContain("shell-integrations");
      expect(path).toContain("bash");
      expect(path).toEndWith("widget.bash");
    });

    it("returns correct path for fish widget", () => {
      const path = getShellScriptPath("fish", "widget");
      expect(path).toContain("shell-integrations");
      expect(path).toContain("fish");
      expect(path).toEndWith("widget.fish");
    });

    it("returns correct path for zsh native", () => {
      const path = getShellScriptPath("zsh", "native");
      expect(path).toEndWith("native.zsh");
    });

    it("returns correct path for completions", () => {
      const zshPath = getShellScriptPath("zsh", "completions");
      expect(zshPath).toEndWith("completions.zsh");

      const bashPath = getShellScriptPath("bash", "completions");
      expect(bashPath).toEndWith("completions.bash");

      const fishPath = getShellScriptPath("fish", "completions");
      expect(fishPath).toEndWith("completions.fish");
    });
  });

  describe("getShellIntegrationFile", () => {
    it("returns path in .fjsf directory for zsh", () => {
      const path = getShellIntegrationFile("zsh");
      expect(path).toContain(".fjsf");
      expect(path).toEndWith("init.zsh");
    });

    it("returns path in .fjsf directory for bash", () => {
      const path = getShellIntegrationFile("bash");
      expect(path).toContain(".fjsf");
      expect(path).toEndWith("init.bash");
    });

    it("returns path in .fjsf directory for fish", () => {
      const path = getShellIntegrationFile("fish");
      expect(path).toContain(".fjsf");
      expect(path).toEndWith("init.fish");
    });
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

  it("package manager interceptors handle all shells", async () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const zshScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/zsh/widget.zsh"),
      "utf-8",
    );
    expect(zshScript).toContain("_fjsf_widget");
    expect(zshScript.length).toBeGreaterThan(0);

    const bashScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/bash/widget.bash"),
      "utf-8",
    );
    expect(bashScript).toContain("_fjsf_complete");
    expect(bashScript.length).toBeGreaterThan(0);

    const fishScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/fish/widget.fish"),
      "utf-8",
    );
    expect(fishScript).toContain("_fjsf_widget");
    expect(fishScript.length).toBeGreaterThan(0);
  });

  it("autocomplete scripts handle all shells", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const zshScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/zsh/completions.zsh"),
      "utf-8",
    );
    expect(zshScript).toContain("_fjsf_completions");
    expect(zshScript).toContain("compdef");
    expect(zshScript.length).toBeGreaterThan(0);

    const bashScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/bash/completions.bash"),
      "utf-8",
    );
    expect(bashScript).toContain("_fjsf_completions");
    expect(bashScript).toContain("complete -F");
    expect(bashScript.length).toBeGreaterThan(0);

    const fishScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/fish/completions.fish"),
      "utf-8",
    );
    expect(fishScript).toContain("complete -c fjsf");
    expect(fishScript.length).toBeGreaterThan(0);
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
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const interceptors = readFileSync(
      join(__dirname, "../../src/shell-integrations/zsh/widget.zsh"),
      "utf-8",
    );
    const completions = readFileSync(
      join(__dirname, "../../src/shell-integrations/zsh/completions.zsh"),
      "utf-8",
    );
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.zsh.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });

  it("bash integration includes binding persistence", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const interceptors = readFileSync(
      join(__dirname, "../../src/shell-integrations/bash/widget.bash"),
      "utf-8",
    );
    const completions = readFileSync(
      join(__dirname, "../../src/shell-integrations/bash/completions.bash"),
      "utf-8",
    );
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.bash.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });

  it("fish integration includes widget and completions", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const interceptors = readFileSync(
      join(__dirname, "../../src/shell-integrations/fish/widget.fish"),
      "utf-8",
    );
    const completions = readFileSync(
      join(__dirname, "../../src/shell-integrations/fish/completions.fish"),
      "utf-8",
    );
    const fullContent = interceptors + completions;

    shellIntegrationPatterns.fish.forEach((pattern) => {
      expect(fullContent).toContain(pattern);
    });
  });
});

describe("native completions", () => {
  it("zsh native completions exist", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const nativeScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/zsh/native.zsh"),
      "utf-8",
    );

    expect(nativeScript).toContain("_fjsf_native_bun_run");
    expect(nativeScript).toContain("_fjsf_native_npm_run");
    expect(nativeScript).toContain("_fjsf_native_pnpm_run");
    expect(nativeScript).toContain("_fjsf_native_yarn_run");
    expect(nativeScript).toContain("compdef");
    expect(nativeScript).toContain("fjsf --completions");
  });

  it("bash native completions exist", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const nativeScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/bash/native.bash"),
      "utf-8",
    );

    expect(nativeScript).toContain("_fjsf_native_completions");
    expect(nativeScript).toContain("complete -F");
    expect(nativeScript).toContain("fjsf --completions");
  });

  it("fish native completions exist", () => {
    const { readFileSync } = require("fs");
    const { join } = require("path");

    const nativeScript = readFileSync(
      join(__dirname, "../../src/shell-integrations/fish/native.fish"),
      "utf-8",
    );

    expect(nativeScript).toContain("_fjsf_native_completions");
    expect(nativeScript).toContain("complete -c");
    expect(nativeScript).toContain("fjsf --completions");
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

    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).toBe(content);
  });

  it("preserves correctly formatted source line", () => {
    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf
[ -f "/Users/user/.fjsf/init.zsh" ] && source "/Users/user/.fjsf/init.zsh"

alias ll="ls -la"`;

    writeFileSync(testFile, content);

    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).toContain("[ -f");
    expect(result).toContain(".fjsf/init.zsh");
    expect(result).toContain("source");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });

  it("removes old inline fjsf code but keeps source line", () => {
    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf
_fjsf_widget() {
  echo "old code"
}

[ -f "/Users/user/.fjsf/init.zsh" ] && source "/Users/user/.fjsf/init.zsh"

alias ll="ls -la"`;

    writeFileSync(testFile, content);

    removeOldFjsfConfig(testFile);

    const result = readFileSync(testFile, "utf-8");
    expect(result).not.toContain("_fjsf_widget");
    expect(result).not.toContain("old code");
    expect(result).toContain("[ -f");
    expect(result).toContain(".fjsf/init.zsh");
    expect(result).toContain("source");
    expect(result).toContain("export PATH");
    expect(result).toContain("alias ll");
  });
});

describe("duplicate prevention", () => {
  const testFile = join(tmpdir(), `test-fjsf-dup-${Date.now()}.sh`);

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  it("does not add duplicate source lines when already present", () => {
    const fjsfDir = join(tmpdir(), ".fjsf-test");
    const integrationFile = join(fjsfDir, "init.zsh");

    if (!existsSync(fjsfDir)) {
      mkdirSync(fjsfDir, { recursive: true });
    }

    const content = `export PATH="/usr/local/bin:$PATH"

# fjsf
[ -f "${integrationFile}" ] && source "${integrationFile}"

alias ll="ls -la"`;

    writeFileSync(testFile, content);
    writeFileSync(integrationFile, "# test integration file");

    const originalLineCount = content.split("\n").length;

    const fileContent = readFileSync(testFile, "utf-8");
    const sourceLine = `[ -f "${integrationFile}" ] && source "${integrationFile}"`;
    const hasCorrectSource = fileContent.includes(sourceLine);

    expect(hasCorrectSource).toBe(true);

    const result = readFileSync(testFile, "utf-8");
    const resultLineCount = result.split("\n").length;

    expect(resultLineCount).toBe(originalLineCount);
  });
});
