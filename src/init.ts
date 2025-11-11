import { stdout } from "process";
import { homedir } from "os";
import {
  existsSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join, dirname } from "path";
import { colors, colorize } from "./terminal.ts";
import { spawnSync } from "child_process";

const getShellScriptPath = (shell: string, scriptType: string): string => {
  const currentDir = dirname(new URL(import.meta.url).pathname);
  return join(
    currentDir,
    "shell-integrations",
    shell,
    `${scriptType}.${shell === "fish" ? "fish" : shell === "bash" ? "bash" : "zsh"}`,
  );
};

const readShellScript = async (
  shell: string,
  scriptType: string,
): Promise<string> => {
  const scriptPath = getShellScriptPath(shell, scriptType);
  const file = Bun.file(scriptPath);
  return await file.text();
};

export const getFjsfDir = (): string => {
  const home = homedir();
  const fjsfDir = join(home, ".fjsf");

  if (!existsSync(fjsfDir)) {
    mkdirSync(fjsfDir, { recursive: true });
  }

  return fjsfDir;
};

export const detectShell = (): string => {
  const shell = process.env.SHELL || "";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  if (shell.includes("fish")) return "fish";
  return "unknown";
};

export const getShellConfigFile = (shell: string): string => {
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

const writeShellIntegrationFile = async (
  shell: string,
  initMode: string,
): Promise<string> => {
  const integrationFile = getShellIntegrationFile(shell);
  const isNativeMode = initMode === "native";

  const scriptType = isNativeMode ? "native" : "widget";
  const interceptorScript = await readShellScript(shell, scriptType);
  const autocompleteScript = await readShellScript(shell, "completions");

  const fjExists = checkIfAliasExists("fj");
  const aliasScript = fjExists ? "" : `\nalias fj='fjsf'\n`;

  const content = `${interceptorScript}

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

    const isSourceLine = trimmed.match(/^\[.*\]\s*&&\s*source.*\.fjsf\/init\./);

    if (trimmed.startsWith("# fjsf")) {
      inFjsfSection = true;
      continue;
    }

    if (inFjsfSection) {
      if (isSourceLine) {
        inFjsfSection = false;
        filteredLines.push(line);
        continue;
      }

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
      !isSourceLine &&
      (trimmed.includes("_fjsf") ||
        trimmed.includes("fjsf --widget") ||
        trimmed.includes(".fjsf/init.") ||
        (trimmed.includes("alias") && trimmed.includes("fj=")) ||
        (trimmed.includes("complete") && trimmed.includes("fjsf")))
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

export const runInit = async (initMode: string = "widget"): Promise<void> => {
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
  stdout.write(colorize(`Completion mode: ${initMode}\n`, colors.dim));

  const configFile = getShellConfigFile(shell);

  if (!configFile) {
    stdout.write(colorize("Could not find shell config file\n", colors.yellow));
    process.exit(1);
  }

  stdout.write(colorize(`Config file: ${configFile}\n`, colors.dim));

  const fjsfDir = getFjsfDir();
  stdout.write(colorize(`fjsf directory: ${fjsfDir}\n\n`, colors.dim));

  const integrationFile = getShellIntegrationFile(shell);
  const fileContent = existsSync(configFile)
    ? readFileSync(configFile, "utf-8")
    : "";
  const sourceLine = `[ -f "${integrationFile}" ] && source "${integrationFile}"`;
  const hasCorrectSource = fileContent.includes(sourceLine);

  if (!hasCorrectSource) {
    removeOldFjsfConfig(configFile);
  }

  await writeShellIntegrationFile(shell, initMode);

  if (!hasCorrectSource) {
    addSourceToShellConfig(configFile, integrationFile);
  } else {
    stdout.write(
      colorize(`\n✓ Already sourced in ${configFile}\n`, colors.green),
    );
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
    stdout.write(colorize("\n✓ Added 'fj' alias for fjsf\n", colors.green));
  }

  installGitHooks();

  stdout.write(
    colorize("\n✅ Setup complete!\n", colors.bright.concat(colors.green)),
  );
  stdout.write(colorize("\nRestart your shell or run: ", colors.dim));
  stdout.write(colorize(`source ${configFile}\n\n`, colors.bright));

  if (initMode === "native") {
    stdout.write(
      colorize(
        "\nℹ️  Using native completions mode (works with fzf-tab)\n",
        colors.cyan,
      ),
    );
  }
};
