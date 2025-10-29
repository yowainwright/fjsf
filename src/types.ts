export interface PackageScript {
  name: string;
  command: string;
  workspace: string;
  packagePath: string;
}

export interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
