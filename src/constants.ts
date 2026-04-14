export const VERSION = "__VERSION__";

export const HELP_TEXT = `fjsf v${VERSION} - Fuzzy JSON Script Finder

USAGE:
  fjsf                    Find all config files recursively, extract scripts, fuzzy search
  fjsf <file>             Extract scripts from a specific file
  fjsf find <name>        Find all files named <name> recursively, extract scripts
  fjsf f <name>           Short form of find
  fjsf path <file>        Search ALL keys in a file (not just scripts)
  fjsf p <file>           Short form of path
  fjsf help | --help | -h Show this help
  fjsf --version | -v     Show version

EXAMPLES:
  fjsf                          # Find all scripts in config files
  fjsf ./package.json           # Extract scripts from specific file
  fjsf find package.json        # Find all package.json files recursively
  fjsf f Cargo.toml             # Find all Cargo.toml files recursively
  fjsf path ./pyproject.toml    # Search all keys in pyproject.toml
  fjsf p ./docker-compose.yml   # Search all keys in docker-compose.yml

SUPPORTED FORMATS:
  JSON   scripts, tasks sections
  TOML   [scripts], [tasks], [tool.taskipy.tasks] sections
  YAML   scripts:, tasks:, jobs: sections

KEYBOARD CONTROLS:
  Type              Fuzzy search
  Up/Down arrows    Navigate results
  Enter             Execute selected value as shell command
  q                 Exit (when search is empty)
  Esc, Ctrl+C       Exit anytime
`;
