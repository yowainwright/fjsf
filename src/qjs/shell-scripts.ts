import type { AllShellScripts } from "./types.ts";

export const SHELL_SCRIPTS: AllShellScripts = {
  zsh: {
    widget: `_fjsf_widget() {
  if [[ "$BUFFER" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=\${match[1]}
    local query=\${match[3]:-""}
    query=\${query%;*}
    local script
    script=$(fjsf --widget "$query" < /dev/tty)

    if [ -n "$script" ]; then
      BUFFER="$pm run $script"
      CURSOR=$#BUFFER
      zle accept-line
    fi
  else
    zle expand-or-complete
  fi
}

zle -N _fjsf_widget

_fjsf_ensure_binding() {
  local current_widget="\${widgets[^I]}"
  if [[ "$current_widget" != "user:_fjsf_widget" ]]; then
    bindkey '^I' _fjsf_widget
  fi
}

bindkey '^I' _fjsf_widget

autoload -Uz add-zsh-hook
add-zsh-hook precmd _fjsf_ensure_binding`,

    native: `_fjsf_run_completions() {
  local -a scripts
  local query="\${words[3]:-}"
  scripts=("\${(@f)$(fjsf --completions "$query" 2>/dev/null)}")
  (( \${#scripts} > 0 )) && _describe 'npm scripts' scripts
}

_fjsf_native_bun_run() {
  [[ \${words[2]} == "run" ]] && (( CURRENT >= 3 )) && { _fjsf_run_completions; return }
  _default
}

_fjsf_native_npm_run() {
  [[ \${words[2]} == "run" ]] && (( CURRENT >= 3 )) && { _fjsf_run_completions; return }
  _default
}

_fjsf_native_pnpm_run() {
  [[ \${words[2]} == "run" ]] && (( CURRENT >= 3 )) && { _fjsf_run_completions; return }
  _default
}

_fjsf_native_yarn_run() {
  [[ \${words[2]} == "run" ]] && (( CURRENT >= 3 )) && { _fjsf_run_completions; return }
  _default
}

compdef _fjsf_native_bun_run bun
compdef _fjsf_native_npm_run npm
compdef _fjsf_native_pnpm_run pnpm
compdef _fjsf_native_yarn_run yarn`,

    completions: `_fjsf_completions() {
  local -a commands
  commands=(
    'find:Find all versions of file'
    'f:Find (short)'
    'path:Query specific file'
    'p:Path (short)'
    'run:Run key from file'
    'r:Run (short)'
    'help:Show help'
    'h:Help (short)'
    'init:Setup shell integration'
    'quit:Exit'
    'q:Quit (short)'
  )
  _describe 'command' commands
}

compdef _fjsf_completions fjsf`,
  },

  bash: {
    widget: `_fjsf_complete() {
  local line="$READLINE_LINE"

  if [[ "$line" =~ ^(npm|pnpm|yarn|bun)[[:space:]]+run([[:space:]](.*))?$ ]]; then
    local pm=\${BASH_REMATCH[1]}
    local query=\${BASH_REMATCH[3]:-""}
    local script
    script=$(fjsf --widget "$query")

    if [ -n "$script" ]; then
      READLINE_LINE="$pm run $script"
      READLINE_POINT=\${#READLINE_LINE}
      return
    fi
  fi

  complete -p &>/dev/null && return 124
}

_fjsf_ensure_binding() {
  if ! bind -X | grep -q '_fjsf_complete'; then
    bind -x '"\\C-i": _fjsf_complete' 2>/dev/null
  fi
}

bind -x '"\\C-i": _fjsf_complete'

if [[ ":$PROMPT_COMMAND:" != *":_fjsf_ensure_binding:"* ]]; then
  PROMPT_COMMAND="_fjsf_ensure_binding\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi`,

    native: `_fjsf_native_completions() {
  local cur prev words cword
  _get_comp_words_by_ref -n : cur prev words cword

  if [[ "\${words[1]}" == "run" ]] && [[ \${cword} -eq 2 ]]; then
    local scripts
    scripts=$(fjsf --completions "$cur" 2>/dev/null | cut -d: -f1)

    COMPREPLY=($(compgen -W "$scripts" -- "$cur"))
  fi
}

complete -F _fjsf_native_completions bun
complete -F _fjsf_native_completions npm
complete -F _fjsf_native_completions pnpm
complete -F _fjsf_native_completions yarn`,

    completions: `_fjsf_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local commands="find f path p run r help h quit q init"

  if [ \${COMP_CWORD} -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  fi
}

complete -F _fjsf_completions fjsf`,
  },

  fish: {
    widget: `function _fjsf_widget
  set -l line (commandline)

  if string match -qr '^(npm|pnpm|yarn|bun)\\s+run(\\s.*)?$' -- $line
    set -l parts (string match -r '^(npm|pnpm|yarn|bun)\\s+run(\\s(.*))?$' -- $line)
    set -l pm $parts[2]
    set -l query $parts[4]
    if test -z "$query"
      set query ""
    end
    set -l script (fjsf --widget "$query")

    if test -n "$script"
      commandline -r "$pm run $script"
      commandline -f execute
    end
  else
    commandline -f complete
  end
end

bind \\t _fjsf_widget`,

    native: `function _fjsf_native_completions
  set -l cmd (commandline -opc)

  if test (count $cmd) -eq 2; and test "$cmd[2]" = "run"
    set -l query (commandline -ct)
    fjsf --completions "$query" 2>/dev/null | while read -l line
      set -l parts (string split : -- $line)
      echo $parts[1]\\t$parts[2]
    end
  end
end

complete -c bun -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c npm -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c pnpm -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f
complete -c yarn -n "__fish_seen_subcommand_from run" -a "(_fjsf_native_completions)" -f`,

    completions: `complete -c fjsf -f
complete -c fjsf -n "__fish_use_subcommand" -a "find" -d "Find all versions of file"
complete -c fjsf -n "__fish_use_subcommand" -a "f" -d "Find (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "path" -d "Query specific file"
complete -c fjsf -n "__fish_use_subcommand" -a "p" -d "Path (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "run" -d "Run key from file"
complete -c fjsf -n "__fish_use_subcommand" -a "r" -d "Run (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "help" -d "Show help"
complete -c fjsf -n "__fish_use_subcommand" -a "h" -d "Help (short)"
complete -c fjsf -n "__fish_use_subcommand" -a "init" -d "Setup shell integration"`,
  },
};
