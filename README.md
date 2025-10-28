# fuzzy-npm-scripts

A zero-dependency CLI tool for fuzzy searching and executing npm scripts across monorepos and regular projects.

## Features

- 🔍 Fuzzy search across all npm scripts in your repository
- 📦 Supports monorepos with workspaces (npm, pnpm, yarn, bun)
- 🚀 Automatic package manager detection
- ⚡ Zero dependencies - built with Bun
- 🎨 Interactive terminal UI with keyboard navigation
- 📍 Shows which workspace each script belongs to

## Installation

```bash
bun install
```

## Usage

Run the CLI tool in any directory containing a `package.json`:

```bash
bun run dev
```

Or build and use the compiled version:

```bash
bun run build
./dist/cli
```

### Keyboard Controls

- Type to search for scripts
- `↑/↓` - Navigate through results
- `Enter` - Execute selected script
- `Esc` or `Ctrl+C` - Exit

## How It Works

The tool automatically:

1. Discovers all `package.json` files in your repository
2. Extracts scripts from each package
3. Detects your package manager (bun, pnpm, yarn, or npm)
4. Provides fuzzy search across script names and workspaces
5. Executes scripts with the correct package manager command

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
├── cli.ts           # Entry point
├── app.ts           # Main application loop
├── types.ts         # TypeScript types
├── discover.ts      # Package.json discovery
├── fuzzy.ts         # Fuzzy search algorithm
├── search.ts        # Search state management
├── state.ts         # Application state
├── renderer.ts      # Terminal UI rendering
├── input.ts         # Keyboard input handling
├── executor.ts      # Script execution
├── terminal.ts      # Terminal utilities
└── package-manager.ts # Package manager detection
```

## Architecture

The codebase is built with functional programming principles:

- Immutable state updates
- Pure, composable functions
- No nested loops
- Clear separation of concerns

## License

MIT
