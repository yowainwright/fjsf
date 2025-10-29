# fpkj (Fuzzy Package JSON)

A zero-dependency CLI tool for fuzzy searching and executing npm scripts, exploring package.json fields with dot notation, and querying any JSON config files across monorepos and regular projects.

## Features

- 🔍 **Scripts Mode**: Fuzzy search and execute npm scripts
- 🗺️ **JSON Explorer Mode**: Browse any package.json field with dot notation (e.g., `dependencies.react`, `scripts.test`)
- 📄 **Custom JSON Mode**: Query any JSON config files (tsconfig.json, etc.)
- 💾 **Smart Caching**: JSON files are cached in memory with mtime validation for instant searches
- 📦 Supports monorepos with workspaces (npm, pnpm, yarn, bun)
- 🚀 Automatic package manager detection
- ⚡ Zero dependencies - built with Bun
- 🎨 Interactive terminal UI with keyboard navigation
- 📍 Shows which workspace each entry belongs to

## Installation

```bash
bun install
```

## Usage

### Scripts Mode (Default)

Search and execute npm scripts:

```bash
fpkj
# or in development
bun run dev
```

### JSON Explorer Mode

Browse all package.json fields with dot notation:

```bash
fpkj json
# or
fpkj j
```

Search examples:

- `dependencies` - View all dependencies
- `scripts.test` - Find test scripts
- `version` - Check versions across workspaces
- `author` - Find author info

### Custom JSON Mode

Query any JSON config files:

```bash
fpkj custom tsconfig.json .eslintrc.json
# or
fpkj c path/to/config.json
```

### Keyboard Controls

- Type to search (fuzzy matching)
- `↑/↓` - Navigate through results
- `Enter` - Execute selected script (scripts mode only)
- `Esc` or `Ctrl+C` - Exit

## How It Works

**Scripts Mode:**

1. Discovers all `package.json` files in your repository
2. Extracts scripts from each package
3. Detects your package manager (bun, pnpm, yarn, or npm)
4. Provides fuzzy search across script names and workspaces
5. Executes scripts with the correct package manager command

**JSON Explorer Mode:**

1. Discovers all `package.json` files
2. Flattens all JSON objects into searchable dot-notation paths
3. Caches JSON with mtime validation for fast subsequent searches
4. Provides fuzzy search across paths, keys, and values

**Custom JSON Mode:**

1. Reads specified JSON files
2. Flattens into dot-notation paths
3. Caches for fast searching
4. Same fuzzy search experience

## Supported Package Managers

- npm
- pnpm
- yarn
- bun

The tool detects your package manager by looking for lock files:

- `bun.lockb` → bun
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` → npm

## Development

```bash
bun run dev          # Run in development mode
bun test             # Run tests
bun run build        # Build for production
bun run typecheck    # Type check
bun run lint         # Lint code
bun run format       # Format code
```

## Git Hooks

The project includes custom git hooks:

- `pre-commit` - Runs format check, lint, and typecheck
- `commit-msg` - Validates conventional commit format
- `post-merge` - Auto-installs dependencies if changed

## Project Structure

```
src/
├── cli.ts              # Entry point
├── app.ts              # Scripts mode application
├── modes.ts            # Mode detection and configuration
├── types.ts            # TypeScript types
├── discover.ts         # Package.json discovery (scripts)
├── cache.ts            # JSON file caching with mtime validation
├── fuzzy.ts            # Fuzzy search algorithm
├── search.ts           # Search state management
├── state.ts            # Application state
├── renderer.ts         # Scripts mode UI rendering
├── input.ts            # Keyboard input handling
├── executor.ts         # Script execution
├── terminal.ts         # Terminal utilities
├── package-manager.ts  # Package manager detection
└── json/
    ├── app.ts          # JSON explorer mode application
    ├── discover.ts     # JSON discovery and flattening
    ├── entry.ts        # JSON entry types and flattening logic
    └── renderer.ts     # JSON mode UI rendering
```

## Architecture

The codebase is built with functional programming principles:

- Immutable state updates
- Pure, composable functions
- No nested loops
- Clear separation of concerns

## License

MIT
