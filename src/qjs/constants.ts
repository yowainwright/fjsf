export const VERSION = "__VERSION__";

export const HELP_TEXT = `fjsf v${VERSION} - Fuzzy JSON Search & Filter

USAGE:
  fjsf                      Search and run npm scripts (default)
  fjsf <package.json>       Search specific package.json scripts
  fjsf find <file>          Find all versions of file and fuzzy search JSON
  fjsf f <file>             Short form of find
  fjsf path <file>          Query a specific JSON file (single file)
  fjsf p <file>             Short form of path
  fjsf run <file> <key>     Run a specific key from JSON file
  fjsf r <file> <key>       Short form of run
  fjsf init                 Setup shell integration (widget mode, default)
  fjsf init --native        Setup with native completions (works with fzf-tab)
  fjsf completions [query]  Output completions for shell integration
  fjsf help                 Show this help
  fjsf h                    Short form of help
  fjsf quit                 Exit
  fjsf q                    Short form of quit

EXAMPLES:
  fjsf                            # Search all npm scripts
  fjsf ./package.json             # Search specific package.json scripts
  fjsf find package.json          # Find all package.json, search all
  fjsf f tsconfig.json            # Find all tsconfig.json
  fjsf path ./tsconfig.json       # Query single tsconfig.json file
  fjsf p ./package.json           # Query single package.json
  fjsf run package.json scripts.build   # Run build script
  fjsf r package.json scripts.test      # Run test script
  fjsf completions                # List all scripts for completion
  fjsf completions test           # Filter completions matching "test"

KEYBOARD CONTROLS:
  Type              Fuzzy search
  Up/Down arrows    Navigate results
  Enter             Run selected (scripts mode)
  q, Esc, Ctrl+C    Exit
`;
