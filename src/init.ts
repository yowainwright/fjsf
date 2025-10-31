import { stdout } from "process";
import { homedir } from "os";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { colors, colorize } from "./terminal.ts";
import { spawnSync } from "child_process";

const detectShell = (): string => {
  const shell = process.env.SHELL || "";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  if (shell.includes("fish")) return "fish";
  return "unknown";
};

const getShellConfigFile = (shell: string): string => {
  const home = homedir();

  if (shell === "zsh") {
    const zshrc = join(home, ".zshrc");
    if (existsSync(zshrc)) return zshrc;
    return join(home, ".zprofile");
  }

  if (shell === "bash") {
    const bashrc = join(home, ".bashrc");
    if (existsSync(bashrc)) return bashrc;
    return join(home, ".bash_profile");
  }

  if (shell === "fish") {
    return join(home, ".config", "fish", "config.fish");
  }

  return "";
};

const checkIfAliasExists = (aliasName: string): boolean => {
  const result = spawnSync("type", [aliasName], {
    shell: true,
    encoding: "utf-8",
  });

  return result.status === 0;
};

const getPackageManagerInterceptors = (shell: string): string => {
  if (shell === "zsh") {
    return `
_fjsf_widget() {
  local line="$BUFFER"

  if [[ "$line" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run[[:space:]](.*)$ ]]; then
    local pm=\${match[1]}
    local query=\${match[2]}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      BUFFER="$pm run $script"
      CURSOR=$#BUFFER
      zle accept-line
    fi
  fi
}

zle -N _fjsf_widget
bindkey '^I' _fjsf_widget
`;
  }

  if (shell === "bash") {
    return `
_fjsf_widget() {
  local line="$READLINE_LINE"

  if [[ "$line" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run[[:space:]](.*)$ ]]; then
    local pm=\${BASH_REMATCH[1]}
    local query=\${BASH_REMATCH[2]}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      READLINE_LINE="$pm run $script"
      READLINE_POINT=\${#READLINE_LINE}
    fi
  fi
}

bind -x '"\\C-i": _fjsf_widget'
`;
  }

  if (shell === "fish") {
    return `
function _fjsf_widget
  set -l line (commandline)

  if string match -qr '^(npm|pnpm|yarn|bun)\\s+run\\s*(.*)$' -- $line
    set -l parts (string match -r '^(npm|pnpm|yarn|bun)\\s+run\\s*(.*)$' -- $line)
    set -l pm $parts[2]
    set -l query $parts[3]
    set -l script (fjsf --widget "$query")

    if test -n "$script"
      commandline -r "$pm run $script"
      commandline -f execute
    end
  end
end

bind \t _fjsf_widget
`;
  }

  return "";
};

const getAutocompleteScript = (shell: string): string => {
  if (shell === "zsh" || shell === "bash") {
    return `
_fjsf_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="find f path p exec e help h quit q init"

  if [ \${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  fi
}

complete -F _fjsf_completions fjsf
`;
  }

  if (shell === "fish") {
    return `
complete -c fjsf -f
complete -c fjsf -n "__fish_use_subcommand" -a "find" -d "Find all versions of file"
complete -c fjsf -n "__fish_use_subcommand" -a "f" -d "Find (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "path" -d "Query specific file"
complete -c fjsf -n "__fish_use_subcommand" -a "p" -d "Path (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "exec" -d "Execute key from file"
complete -c fjsf -n "__fish_use_subcommand" -a "e" -d "Exec (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "help" -d "Show help"
complete -c fjsf -n "__fish_use_subcommand" -a "h" -d "Help (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "init" -d "Setup shell integration"
`;
  }

  return "";
};

const removeOldFjsfConfig = (configFile: string): void => {
  if (!existsSync(configFile)) {
    return;
  }

  const fileContent = readFileSync(configFile, "utf-8");
  const lines = fileContent.split("\n");
  const filteredLines: string[] = [];
  let skipUntilBlank = false;

  for (const line of lines) {
    if (line.includes("# fjsf")) {
      skipUntilBlank = true;
      continue;
    }

    if (skipUntilBlank) {
      if (line.trim() === "") {
        skipUntilBlank = false;
      }
      continue;
    }

    filteredLines.push(line);
  }

  const newContent = filteredLines.join("\n");
  if (newContent !== fileContent) {
    writeFileSync(configFile, newContent);
    stdout.write(colorize("\n✓ Removed old fjsf configuration\n", colors.dim));
  }
};

const addToShellConfig = (
  configFile: string,
  content: string,
  marker: string,
): void => {
  if (!existsSync(configFile)) {
    stdout.write(
      colorize(`\nConfig file not found: ${configFile}\n`, colors.yellow),
    );
    return;
  }

  const fileContent = readFileSync(configFile, "utf-8");

  if (fileContent.includes(marker)) {
    stdout.write(
      colorize(`\n✓ Already configured in ${configFile}\n`, colors.green),
    );
    return;
  }

  const entry = `\n${marker}\n${content}\n`;
  appendFileSync(configFile, entry);
  stdout.write(colorize(`\n✓ Added to ${configFile}\n`, colors.green));
};

const installGitHooks = (): void => {
  const isGitRepo = existsSync(".git");

  if (!isGitRepo) {
    stdout.write(
      colorize(
        "\nℹ️  Not in a git repository, skipping git hooks setup\n",
        colors.dim,
      ),
    );
    return;
  }

  stdout.write(colorize("\nInstalling git hooks...\n", colors.dim));

  const result = spawnSync("bun", ["run", "scripts/install-hooks.ts"], {
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status === 0) {
    stdout.write(colorize("✓ Git hooks installed\n", colors.green));
  } else {
    stdout.write(colorize("⚠️  Failed to install git hooks\n", colors.yellow));
  }
};

export const runInit = (): void => {
  stdout.write(
    colorize(
      "\nfjsf shell integration setup\n\n",
      colors.bright.concat(colors.cyan),
    ),
  );

  const shell = detectShell();

  if (shell === "unknown") {
    stdout.write(
      colorize(
        "Unable to detect shell type. Supported: bash, zsh, fish\n",
        colors.yellow,
      ),
    );
    process.exit(1);
  }

  stdout.write(colorize(`Detected shell: ${shell}\n`, colors.dim));

  const configFile = getShellConfigFile(shell);

  if (!configFile) {
    stdout.write(colorize("Could not find shell config file\n", colors.yellow));
    process.exit(1);
  }

  stdout.write(colorize(`Config file: ${configFile}\n\n`, colors.dim));

  removeOldFjsfConfig(configFile);

  const interceptorScript = getPackageManagerInterceptors(shell);
  if (interceptorScript) {
    addToShellConfig(configFile, interceptorScript, "# fjsf interceptors");
  }

  const autocompleteScript = getAutocompleteScript(shell);
  if (autocompleteScript) {
    addToShellConfig(configFile, autocompleteScript, "# fjsf completion");
  }

  const fjExists = checkIfAliasExists("fj");

  if (fjExists) {
    stdout.write(
      colorize("\n⚠️  Alias 'fj' is already in use.\n", colors.yellow),
    );
    stdout.write(
      colorize(
        "You can still use 'fjsf' or manually add your preferred alias.\n",
        colors.dim,
      ),
    );
  } else {
    const aliasScript = `alias fj='fjsf'`;
    addToShellConfig(configFile, aliasScript, "# fjsf alias");
    stdout.write(colorize("\n✓ Added 'fj' alias for fjsf\n", colors.green));
  }

  installGitHooks();

  stdout.write(
    colorize("\n✅ Setup complete!\n", colors.bright.concat(colors.green)),
  );
  stdout.write(colorize("\nRestart your shell or run: ", colors.dim));
  stdout.write(colorize(`source ${configFile}\n\n`, colors.bright));
};
