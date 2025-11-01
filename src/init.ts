import { stdout } from "process";
import { homedir } from "os";
import {
  existsSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { colors, colorize } from "./terminal.ts";
import { spawnSync } from "child_process";

const getFjsfDir = (): string => {
  const home = homedir();
  const fjsfDir = join(home, ".fjsf");

  if (!existsSync(fjsfDir)) {
    mkdirSync(fjsfDir, { recursive: true });
  }

  return fjsfDir;
};

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

const getShellIntegrationFile = (shell: string): string => {
  const fjsfDir = getFjsfDir();
  return join(fjsfDir, `init.${shell}`);
};

const writeShellIntegrationFile = (shell: string): string => {
  const integrationFile = getShellIntegrationFile(shell);
  const interceptorScript = getPackageManagerInterceptors(shell);
  const autocompleteScript = getAutocompleteScript(shell);

  const fjExists = checkIfAliasExists("fj");
  const aliasScript = fjExists ? "" : `\n# fjsf alias\nalias fj='fjsf'\n`;

  const content = `# fjsf shell integration
${interceptorScript}
${autocompleteScript}${aliasScript}`;

  writeFileSync(integrationFile, content);
  stdout.write(colorize(`\n✓ Created ${integrationFile}\n`, colors.green));

  return integrationFile;
};

const checkIfAliasExists = (aliasName: string): boolean => {
  const result = spawnSync("type", [aliasName], {
    shell: true,
    encoding: "utf-8",
  });

  return result.status === 0;
};

export const getPackageManagerInterceptors = (shell: string): string => {
  if (shell === "zsh") {
    return `
_fjsf_widget() {
  if [[ "$BUFFER" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=\${match[1]}
    local query=\${match[3]:-""}
    query=\${query%;*}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      BUFFER="$pm run $script"
      CURSOR=$#BUFFER
      zle accept-line
    fi
  else
    zle expand-or-complete
  fi
}

zle -N _fjsf_widget

# Ensure our binding persists even if other tools (like bun) try to override it
_fjsf_ensure_binding() {
  # Only re-bind if something else has taken over Tab
  local current_widget="\${widgets[^I]}"
  if [[ "$current_widget" != "user:_fjsf_widget" ]]; then
    bindkey '^I' _fjsf_widget
  fi
}

# Run once on load
bindkey '^I' _fjsf_widget

# Re-bind before every prompt to maintain precedence over runtime completions
autoload -Uz add-zsh-hook
add-zsh-hook precmd _fjsf_ensure_binding
`;
  }

  if (shell === "bash") {
    return `
_fjsf_complete() {
  local line="$READLINE_LINE"

  if [[ "$line" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=\${BASH_REMATCH[1]}
    local query=\${BASH_REMATCH[3]:-""}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      READLINE_LINE="$pm run $script"
      READLINE_POINT=\${#READLINE_LINE}
      return
    fi
  fi

  complete -p &>/dev/null && return 124
}

# Ensure our binding persists even if other tools (like bun) try to override it
_fjsf_ensure_binding() {
  # Only re-bind if our binding is not active (check if bind output contains our function)
  if ! bind -X | grep -q '_fjsf_complete'; then
    bind -x '"\\C-i": _fjsf_complete' 2>/dev/null
  fi
}

# Run once on load
bind -x '"\\C-i": _fjsf_complete'

# Re-bind before every prompt to maintain precedence over runtime completions
if [[ ":$PROMPT_COMMAND:" != *":_fjsf_ensure_binding:"* ]]; then
  PROMPT_COMMAND="_fjsf_ensure_binding\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
`;
  }

  if (shell === "fish") {
    return `
function _fjsf_widget
  set -l line (commandline)

  if string match -qr '^(npm|pnpm|yarn|bun)\\s+run(\\s.*)?$' -- $line
    set -l parts (string match -r '^(npm|pnpm|yarn|bun)\\s+run(\\s(.*))?$' -- $line)
    set -l pm $parts[2]
    set -l query $parts[4]
    if test -z "$query"
      set query ""
    end
    set -l script (fjsf --widget "$query")

    if test -n "$script"
      commandline -r "$pm run $script"
      commandline -f execute
    end
  else
    commandline -f complete
  end
end

bind \t _fjsf_widget
`;
  }

  return "";
};

export const getAutocompleteScript = (shell: string): string => {
  if (shell === "zsh") {
    return `
_fjsf_completions() {
  local -a commands
  commands=(
    'find:Find all versions of file'
    'f:Find (short)'
    'path:Query specific file'
    'p:Path (short)'
    'exec:Execute key from file'
    'e:Exec (short)'
    'help:Show help'
    'h:Help (short)'
    'init:Setup shell integration'
    'quit:Exit'
    'q:Quit (short)'
  )
  _describe 'command' commands
}

compdef _fjsf_completions fjsf
`;
  }

  if (shell === "bash") {
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

export const removeOldFjsfConfig = (configFile: string): void => {
  if (!existsSync(configFile)) {
    return;
  }

  const fileContent = readFileSync(configFile, "utf-8");
  const lines = fileContent.split("\n");
  const filteredLines: string[] = [];
  let inFjsfSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("# fjsf")) {
      inFjsfSection = true;
      continue;
    }

    if (inFjsfSection) {
      if (
        trimmed === "" ||
        (trimmed.startsWith("#") && !trimmed.includes("fjsf"))
      ) {
        inFjsfSection = false;
      } else {
        continue;
      }
    }

    if (
      trimmed.includes("_fjsf") ||
      trimmed.includes("fjsf --widget") ||
      trimmed.includes(".fjsf/init.") ||
      (trimmed.includes("source") && trimmed.includes(".fjsf")) ||
      (trimmed.includes("alias") && trimmed.includes("fj=")) ||
      (trimmed.includes("complete") && trimmed.includes("fjsf"))
    ) {
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

const addSourceToShellConfig = (
  configFile: string,
  integrationFile: string,
): void => {
  if (!existsSync(configFile)) {
    stdout.write(
      colorize(`\nConfig file not found: ${configFile}\n`, colors.yellow),
    );
    return;
  }

  const fileContent = readFileSync(configFile, "utf-8");
  const sourceLine = `[ -f "${integrationFile}" ] && source "${integrationFile}"`;

  if (
    fileContent.includes(integrationFile) ||
    (fileContent.includes("source") && fileContent.includes(".fjsf/init."))
  ) {
    stdout.write(
      colorize(`\n✓ Already sourced in ${configFile}\n`, colors.green),
    );
    return;
  }

  const entry = `\n# fjsf\n${sourceLine}\n`;
  appendFileSync(configFile, entry);
  stdout.write(
    colorize(`\n✓ Added source line to ${configFile}\n`, colors.green),
  );
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

  stdout.write(colorize(`Config file: ${configFile}\n`, colors.dim));

  const fjsfDir = getFjsfDir();
  stdout.write(colorize(`fjsf directory: ${fjsfDir}\n\n`, colors.dim));

  removeOldFjsfConfig(configFile);

  const integrationFile = writeShellIntegrationFile(shell);

  addSourceToShellConfig(configFile, integrationFile);

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
    stdout.write(colorize("\n✓ Added 'fj' alias for fjsf\n", colors.green));
  }

  installGitHooks();

  stdout.write(
    colorize("\n✅ Setup complete!\n", colors.bright.concat(colors.green)),
  );
  stdout.write(colorize("\nRestart your shell or run: ", colors.dim));
  stdout.write(colorize(`source ${configFile}\n\n`, colors.bright));
};
