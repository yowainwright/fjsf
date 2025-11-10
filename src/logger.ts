import { colors, colorize } from "./terminal.ts";

const createLogger = () => {
  const logWithColor = (
    level: "debug" | "info" | "warn" | "error",
    ...args: unknown[]
  ) => {
    const formattedArgs = args.map((arg) => {
      const isObject = typeof arg === "object" && arg !== null;
      return isObject ? JSON.stringify(arg, null, 2) : String(arg);
    });

    const levelColors = {
      debug: colors.dim,
      info: colors.cyan,
      warn: colors.yellow,
      error: colors.bright.concat(colors.yellow),
    };

    const color = levelColors[level];
    const message = formattedArgs.join(" ");
    const coloredMessage = colorize(message, color);

    const consoleMethods = {
      debug: console.debug,
      info: console.log,
      warn: console.warn,
      error: console.error,
    };

    consoleMethods[level](coloredMessage);
    return logger;
  };

  const logger = {
    debug: (...args: unknown[]) => logWithColor("debug", ...args),
    info: (...args: unknown[]) => logWithColor("info", ...args),
    warn: (...args: unknown[]) => logWithColor("warn", ...args),
    error: (...args: unknown[]) => logWithColor("error", ...args),
  };

  return logger;
};

export const log = createLogger();
