# fjsf

[![npm version](https://badge.fury.io/js/fjsf.svg)](https://www.npmjs.com/package/fjsf)
[![GitHub Actions](https://github.com/yowainwright/fjsf/workflows/Test/badge.svg)](https://github.com/yowainwright/fjsf/actions)
[![codecov](https://codecov.io/gh/yowainwright/fjsf/branch/main/graph/badge.svg)](https://codecov.io/gh/yowainwright/fjsf)

> ### Fuzzy JSON Search & Filter

A zero-dependency CLI tool for fuzzy searching and executing scripts within json. This is especially useful for exploring `package.json` fields with dot notation, and querying any JSON config files across monorepos and regular projects.

### Traverse. Search. Execute. Fuzzy search filter your JSON files in style. 🤘

<img src="https://github.com/user-attachments/assets/775d89a7-fc00-46eb-a1f6-c518a59d27a2" width=500 />

## Why fjsf?

**Stop typing full script names.** Run `fjsf init` once, then just type `npm run t<TAB>` and get an interactive tooltip with all your scripts. That's it. No more:

- Typing `npm run test:unit:watch:verbose`
- Opening `package.json` to remember script names
- Scrolling through `npm run` help text
- Context switching between editor and terminal

Type less. Run faster. Stay in flow.

## Architecture

<p align="center">You start here. <br/> Lost. In a sea of monorepo workspaces trying to remember the script you need,<br />you type <code>fjsf</code> and...</p>

```mermaid
graph TD
    A[CLI Entry] --> B{Parse Mode}
    B -->|scripts| C[Scripts Mode]
    B -->|find| D[Find Mode]
    B -->|path| E[Path Mode]
    B -->|exec| F[Exec Mode]
    B -->|init| G[Shell Integration]
    B -->|help/quit| H[Exit]

    C --> I[Discover package.json]
    I --> J[Extract Scripts]
    J --> K[Fuzzy Search UI]
    K --> L[Execute Script]

    D --> M[Find All Files]
    M --> N[Flatten JSON]
    N --> O[Cache with mtime]
    O --> K

    E --> P[Load Single File]
    P --> N

    F --> Q[Read JSON]
    Q --> R[Validate Key]
    R --> L

    G --> S[Detect Shell]
    S --> T[Add Autocomplete]
    T --> U[Add Alias]
```

<p align=center>You end here.<br />Just as lonely as before.<br />But you executed that npm script you needed lickety-split!</p>

## Features

- **Shell Integration**: Interactive tooltip when you type `npm run <TAB>` - fuzzy search scripts without leaving your terminal
- **Scripts Mode**: Fuzzy search and execute npm scripts
- **Find Mode**: Find all versions of a file across your repo and fuzzy search their JSON
- **Path Mode**: Query a specific JSON file with fuzzy search
- **Exec Mode**: Execute specific keys from JSON files directly
- **Smart Caching**: JSON files are cached in memory with mtime validation for instant searches
- Supports monorepos with workspaces (npm, pnpm, yarn, bun)
- Automatic package manager detection
- Zero dependencies - built with Bun
- Interactive terminal UI with keyboard navigation
- Shows which workspace and file each entry belongs to

## Usage

### Scripts Mode (Default)

Search and execute npm scripts from package.json:

```bash
fjsf                    # Search all package.json scripts
fjsf <package.json>     # Search specific package.json file
```

### Find Mode

Find all versions of a file across your repo and fuzzy search their JSON:

```bash
fjsf find <filename>    # Find all files with this name
fjsf f <filename>       # Short form
```

Examples:

```bash
fjsf find package.json    # Find all package.json files, search their contents
fjsf f tsconfig.json      # Find all tsconfig.json files
fjsf find .eslintrc.json  # Find all .eslintrc.json files
```

This will:

1. Find ALL files matching the name across your repo (including workspaces)
2. Flatten all their JSON into dot-notation paths
3. Let you fuzzy search across ALL fields from ALL found files
4. Show which file/workspace each result comes from

Search examples once in find mode:

- Type `react` - View all React dependencies across all package.json files
- Type `version` - Check versions across workspaces
- Type `compilerOptions.target` - See all TS targets in tsconfigs
- Type `scripts.test` - Find all test scripts

### Path Mode

Query a specific JSON file (single file):

```bash
fjsf path <file>        # Query a specific JSON file
fjsf p <file>           # Short form
```

Examples:

```bash
fjsf path ./tsconfig.json       # Query single tsconfig.json
fjsf p ./package.json           # Query single package.json
fjsf path ./config/app.json     # Query any JSON file
```

This mode:

1. Loads ONE specific JSON file
2. Flattens it into dot-notation paths
3. Provides fuzzy search across all fields in that file

### Exec Mode

Execute a specific key from a JSON file:

```bash
fjsf exec <file> <key>     # Execute a key (scripts only)
fjsf e <file> <key>        # Short form
```

Examples:

```bash
fjsf exec package.json scripts.build    # Run the build script
fjsf e package.json scripts.test        # Run the test script
fjsf e package.json scripts.dev         # Run the dev script
```

Note: Can only execute keys that start with `scripts.` and have string values.

### Shell Integration

Never need to ask, "what was that npm script again?" again!

```bash
fjsf init
```

After setup, restart your shell. Now the magic happens:

```bash
npm run →           # Interactive tooltip appears!
                    # Shows: test, build, dev, lint...
                    # Type to filter, arrow keys to navigate, Enter to run

npm run t→          # Shows: test, test:watch, typecheck...
pnpm run bui→       # Shows: build, build:prod, build:dev...
yarn run d→         # Shows: dev, deploy, docs...
bun run li→         # Shows: lint, lint:fix...
```

**How it works:**

- Type `npm run` (or pnpm/yarn/bun) followed by optional partial script name
- Press **Right Arrow (→)** to trigger the interactive tooltip
- The tooltip appears right at your cursor showing fuzzy-matched scripts
- Your partial input becomes the fuzzy search query
- Arrow up/down to navigate matches
- Press Enter to execute the selected script
- The same fjsf interface you know, but inline in your terminal

**Why this is awesome:**

- No context switching - stays in your terminal flow
- Fuzzy matching means `npm run t` finds `test`, `typecheck`, `test:watch`
- Works across all package managers (npm, pnpm, yarn, bun)
- Shows workspace info in monorepos
- Zero dependencies, instant performance

Supports: bash, zsh, fish

**Customizing the key binding:**

Don't like Right Arrow? Change it! After running `fjsf init`, edit your shell config:

**Zsh** (`~/.zshrc`):

```bash
bindkey '\e[C' _fjsf_widget    # Remove this line (Right Arrow)
bindkey '^ ' _fjsf_widget      # Add this (Ctrl+Space)
```

**Bash** (`~/.bashrc`):

```bash
bind -x '"\\e[C": _fjsf_complete'    # Remove this line (Right Arrow)
bind -x '"\\C- ": _fjsf_complete'    # Add this (Ctrl+Space)
```

**Fish** (`~/.config/fish/config.fish`):

```bash
bind \e\[C _fjsf_widget    # Remove this line (Right Arrow)
bind \c\  _fjsf_widget     # Add this (Ctrl+Space)
```

Common key bindings: `\e[C` (Right Arrow), `^ `/`\c\ ` (Ctrl+Space), `^I`/`\t` (Tab), `^F`/`\cf` (Ctrl+F)

### Help & Quit

```bash
fjsf help               # Show help
fjsf h                  # Short form
fjsf quit               # Exit gracefully
fjsf q                  # Short form
```

### Keyboard Controls

- Type to search (fuzzy matching)
- `↑/↓` - Navigate through results
- `Enter` - Execute selected script (scripts mode only)
- `q`, `Esc` or `Ctrl+C` - Exit

## Modes

**Scripts Mode:**

1. Discovers all `package.json` files in your repository
2. Extracts scripts from each package
3. Detects your package manager (bun, pnpm, yarn, or npm)
4. Provides fuzzy search across script names and workspaces
5. Executes scripts with the correct package manager command

**Find Mode:**

1. Searches your repository for all files matching the given filename
2. Flattens all found JSON files into searchable dot-notation paths
3. Caches JSON with mtime validation for fast subsequent searches
4. Provides fuzzy search across paths, keys, and values from ALL found files
5. Shows which file/workspace each entry belongs to

**Exec Mode:**

1. Reads the specified JSON file
2. Navigates to the specified key using dot notation
3. Validates the key is a script (starts with `scripts.`)
4. Executes the script with the appropriate package manager

## Installation

### npm

```bash
bun install -g fjsf
```

### Homebrew

```bash
brew tap yowainwright/fjsf
brew install fjsf
```

### Binary

Download the latest binary for your platform from the [releases page](https://github.com/yowainwright/fjsf/releases):

- Linux: `fjsf-linux-x64`
- macOS (Intel): `fjsf-darwin-x64`
- macOS (ARM): `fjsf-darwin-arm64`
- Windows: `fjsf-windows-x64.exe`

Make the binary executable and move it to your PATH:

```bash
chmod +x fjsf-*
sudo mv fjsf-* /usr/local/bin/fjsf
```

## License

MIT
