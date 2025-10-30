import { stdout } from "process";
import { homedir } from "os";
import { existsSync, readFileSync, appendFileSync } from "fs";
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

const getAutocompleteScript = (shell: string): string => {
  if (shell === "zsh" || shell === "bash") {
    return `
# fjsf shell completion
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
# fjsf shell completion
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

  const autocompleteScript = getAutocompleteScript(shell);
  if (autocompleteScript) {
    addToShellConfig(configFile, autocompleteScript, "# fjsf shell completion");
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
