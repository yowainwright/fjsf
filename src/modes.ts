export type AppMode = "scripts" | "json" | "custom";

export interface ModeConfig {
  mode: AppMode;
  customPaths?: string[];
}

export const parseCliArgs = (args: string[]): ModeConfig => {
  const firstArg = args[0];
  const mode = firstArg;

  const isJsonMode = mode === "json";
  const isJsonShorthand = mode === "j";
  const shouldUseJsonMode = isJsonMode || isJsonShorthand;

  if (shouldUseJsonMode) {
    const config = Object.assign({}, { mode: "json" as const });
    return config;
  }

  const isCustomMode = mode === "custom";
  const isCustomShorthand = mode === "c";
  const shouldUseCustomMode = isCustomMode || isCustomShorthand;

  if (shouldUseCustomMode) {
    const allArgs = args.slice(1);
    const filter = (arg: string): boolean => !arg.startsWith("-");
    const customPaths = allArgs.filter(filter);
    const config = Object.assign({}, { mode: "custom" as const, customPaths });
    return config;
  }

  const defaultConfig = Object.assign({}, { mode: "scripts" as const });
  return defaultConfig;
};

export const getModeTitle = (config: ModeConfig): string => {
  const mode = config.mode;

  const isScriptsMode = mode === "scripts";
  if (isScriptsMode) {
    return "Fuzzy Package JSON - Scripts";
  }

  const isJsonMode = mode === "json";
  if (isJsonMode) {
    return "Fuzzy Package JSON - Explorer";
  }

  const isCustomMode = mode === "custom";
  if (isCustomMode) {
    return "Fuzzy Package JSON - Custom Files";
  }

  return "Fuzzy Package JSON - Scripts";
};
